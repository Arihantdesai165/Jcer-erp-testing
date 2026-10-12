import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, Filter, ChevronLeft, ChevronRight, Eye, CheckCircle2, Clock, XCircle, FileText, 
  RefreshCw, Download, User, Phone, MapPin, Calendar, BookOpen, Loader2, ArrowRight, ShieldCheck, Mail, ClipboardList, ShieldAlert, Award, Edit, GraduationCap, X, Briefcase, FileSignature, CheckSquare, Trash2, Ban, AlertTriangle, Layers
} from 'lucide-react';
import { toast } from 'react-toastify';
import { getAcademicYear } from '../../../utils/date.util';
import API from '../../../services/api';
import admissionService, { AdmissionApplication } from '../../../services/admission.service';
import { downloadAdmissionPDF } from '../../admission/src/utils/pdfGenerator';
import { generateStudentReport, ExportFilterMetadata } from '../../../utils/studentExportGenerator';
import { ShowStudentsRangeSelector } from '../../../components/common/ShowStudentsRangeSelector';

const STATUS_COLOR_MAP: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700',
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-450 dark:border-blue-900/40',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/40',
  APPROVED: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-450 dark:border-indigo-900/40',
  PRINCIPAL_APPROVED: 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/20 dark:text-violet-450 dark:border-violet-900/40',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/40',
  ENROLLED: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/40',
  CANCELLATION_REQUESTED: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/40',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/40',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Verified (Admin)',
  PRINCIPAL_APPROVED: 'Principal Approved',
  REJECTED: 'Rejected',
  ENROLLED: 'Enrolled',
  CANCELLATION_REQUESTED: 'Cancellation Requested',
  CANCELLED: 'Admission Cancelled',
};

const getPhotoUrl = (path: string | null | undefined) => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  
  let cleanPath = path;
  if (!cleanPath.startsWith('/uploads/') && !cleanPath.startsWith('uploads/')) {
    cleanPath = cleanPath.startsWith('/') ? `/uploads${cleanPath}` : `/uploads/${cleanPath}`;
  } else {
    cleanPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  }

  const base = API.defaults.baseURL || '/api';
  const host = base.replace(/\/api\/?$/, '');
  const token = localStorage.getItem('token');
  const url = host.startsWith('/') ? cleanPath : `${host}${cleanPath}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

interface StudentsDashboardPageProps {
  readOnly?: boolean;
}

export const StudentsDashboardPage: React.FC<StudentsDashboardPageProps> = ({ readOnly = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<AdmissionApplication[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    submitted: 0,
    resubmitted: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    enrolled: 0,
    cancelled: 0
  });

  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  
  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [academicYear, setAcademicYear] = useState('ALL');
  const [batch, setBatch] = useState('ALL');
  const [branchId, setBranchId] = useState('ALL');
  const [semester, setSemester] = useState('ALL');
  const [status, setStatus] = useState('ENROLLED');
  const [admissionType, setAdmissionType] = useState('ALL');
  const [qualification, setQualification] = useState('ALL');
  const [gender, setGender] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [district, setDistrict] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [showFilters, setShowFilters] = useState(true);

  // Available batches list (dynamic from server + default cohorts)
  const [availableBatches, setAvailableBatches] = useState<string[]>([
    '2026–2030',
    '2025–2029',
    '2024–2028',
    '2023–2027',
    '2022–2026',
    '2021–2025'
  ]);

  // Pending filter state (applied only on "Apply Filters")
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingAcademicYear, setPendingAcademicYear] = useState('ALL');
  const [pendingBatch, setPendingBatch] = useState('ALL');
  const [pendingBranchId, setPendingBranchId] = useState('ALL');
  const [pendingSemester, setPendingSemester] = useState('ALL');
  const [pendingStatus, setPendingStatus] = useState('ENROLLED');
  const [pendingAdmissionType, setPendingAdmissionType] = useState('ALL');
  const [pendingQualification, setPendingQualification] = useState('ALL');
  const [pendingGender, setPendingGender] = useState('ALL');
  const [pendingCategory, setPendingCategory] = useState('ALL');
  const [pendingDistrict, setPendingDistrict] = useState('');
  const [pendingStartDate, setPendingStartDate] = useState('');
  const [pendingEndDate, setPendingEndDate] = useState('');
  const [pendingSortBy, setPendingSortBy] = useState('date');
  const [pendingSortOrder, setPendingSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Modal / Detail States
  const [selectedStudent, setSelectedStudent] = useState<AdmissionApplication | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelDirectModalOpen, setCancelDirectModalOpen] = useState(false);
  const [cancelDirectStep, setCancelDirectStep] = useState<1 | 2>(1);
  const [cancelDirectReason, setCancelDirectReason] = useState('');
  const [cancelDirectRemarks, setCancelDirectRemarks] = useState('');
  const [cancelDirectSubmitting, setCancelDirectSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const handleOpenCancelModal = (e: React.MouseEvent, app: AdmissionApplication) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Cancel Admission clicked", app);
    setSelectedStudent(app);
    setCancelDirectReason('');
    setCancelDirectRemarks('');
    setCancelDirectStep(1);
    setCancelDirectModalOpen(true);
  };

  const handleDirectCancelSubmit = async () => {
    if (!selectedStudent || !cancelDirectReason) return;
    setCancelDirectSubmitting(true);
    try {
      await admissionService.directCancel(selectedStudent.id, cancelDirectReason, cancelDirectRemarks);
      toast.success('Admission cancelled successfully.');
      setCancelDirectModalOpen(false);
      setCancelDirectReason('');
      setCancelDirectRemarks('');
      setCancelDirectStep(1);
      if (viewModalOpen) setViewModalOpen(false);
      handleRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to cancel admission');
    } finally {
      setCancelDirectSubmitting(false);
    }
  };

  const handleBulkDeleteCancelled = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleteSubmitting(true);
    try {
      const res = await API.delete('/admin/admissions/bulk-delete-cancelled');
      if (res.data.success) {
        toast.success(res.data.message || 'Cancelled student records permanently deleted.');
        setDeleteModalOpen(false);
        setDeleteInput('');
        handleRefresh();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete cancelled student records.');
    } finally {
      setDeleteSubmitting(false);
    }
  };
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    id: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    applicationStatus: '',
    adminRemarks: '',
  });

  // Export form state
  const [exportForm, setExportForm] = useState({
    academicYear: getAcademicYear(),
    branchId: 'ALL',
    status: 'ALL',
    admissionType: 'ALL',
    qualification: 'ALL',
    exportType: 'summary' as 'summary' | 'complete',
    format: 'excel' as 'excel' | 'csv' | 'pdf'
  });

  const fetchStatsAndBranches = async () => {
    try {
      const [statsData, branchData, batchData] = await Promise.all([
        admissionService.getStats(),
        admissionService.getBranches(),
        admissionService.getAvailableBatches()
      ]);
      if (statsData) {
        setStats(statsData as any);
      }
      if (branchData) setBranches(branchData);
      if (batchData && Array.isArray(batchData) && batchData.length > 0) {
        setAvailableBatches(batchData);
      }
    } catch (e) {
      console.error('Failed to load stats/branches/batches', e);
    }
  };

  const fetchStudentsList = async () => {
    setLoading(true);
    try {
      const res = await admissionService.listApplications({
        page,
        limit,
        status: status === 'ALL' ? undefined : status,
        branchId: branchId === 'ALL' ? undefined : branchId,
        semester: semester === 'ALL' ? undefined : semester,
        admissionType: admissionType === 'ALL' ? undefined : admissionType,
        qualification: qualification === 'ALL' ? undefined : qualification,
        gender: gender === 'ALL' ? undefined : gender,
        category: category === 'ALL' ? undefined : category,
        district: district.trim() || undefined,
        academicYear: academicYear === 'ALL' ? undefined : academicYear,
        batch: batch === 'ALL' ? undefined : batch,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search.trim() || undefined,
        sortBy,
        sortOrder
      });

      let mergedApplications = res.applications || [];
      let mergedTotal = res.total || 0;

      setStudents(mergedApplications);
      setTotalPages(res.totalPages || 1);
      setTotalCount(mergedTotal);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load student records');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchStatsAndBranches();
  }, []);

  useEffect(() => {
    const handleExportEvent = () => {
      const prefix = location.pathname.startsWith('/principal') ? '/principal' : '/admin';
      navigate(`${prefix}/student-export`);
    };
    window.addEventListener('trigger-student-export', handleExportEvent);

    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'export') {
      const prefix = location.pathname.startsWith('/principal') ? '/principal' : '/admin';
      navigate(`${prefix}/student-export`);
    }

    return () => {
      window.removeEventListener('trigger-student-export', handleExportEvent);
    };
  }, [location.pathname, navigate]);

  useEffect(() => {
    fetchStudentsList();
  }, [
    page, limit, status, branchId, semester, admissionType, qualification, gender, category, 
    district, startDate, endDate, sortBy, sortOrder, search, academicYear, batch
  ]);

  // Debounced auto-search as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pendingSearch.trim() !== search) {
        setSearch(pendingSearch.trim());
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [pendingSearch]);

  const handleExecuteSearch = () => {
    setSearch(pendingSearch.trim());
    setAcademicYear(pendingAcademicYear);
    setBatch(pendingBatch);
    setBranchId(pendingBranchId);
    setSemester(pendingSemester);
    setStatus(pendingStatus);
    setAdmissionType(pendingAdmissionType);
    setQualification(pendingQualification);
    setGender(pendingGender);
    setCategory(pendingCategory);
    setDistrict(pendingDistrict);
    setStartDate(pendingStartDate);
    setEndDate(pendingEndDate);
    setSortBy(pendingSortBy);
    setSortOrder(pendingSortOrder);
    setPage(1);
  };

  const handleRefresh = () => {
    fetchStatsAndBranches();
    fetchStudentsList();
  };

  const [viewModalLoading, setViewModalLoading] = useState(false);

  const handleViewStudent = (id: string) => {
    const prefix = location.pathname.startsWith('/principal') ? '/principal' : '/admin';
    navigate(`${prefix}/students/view/${id}`);
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setSelectedStudent(null);
  };

  const handleDownloadPDF = async (id: string) => {
    await downloadAdmissionPDF(API, toast, id);
  };

  const handleEditClick = (app: AdmissionApplication) => {
    setEditForm({
      id: app.id,
      firstName: app.user?.firstName || '',
      lastName: app.user?.lastName || '',
      phone: app.user?.phone || '',
      email: app.user?.email || '',
      applicationStatus: app.applicationStatus,
      adminRemarks: app.adminRemarks || '',
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      await API.put(`/admin/admissions/${editForm.id}/status`, {
        status: editForm.applicationStatus,
        remarks: editForm.adminRemarks
      });
      // Optionally update user details if backend supports, but we focus on status/remarks
      toast.success('Student application updated successfully');
      setEditModalOpen(false);
      handleRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update student application');
    }
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportForm.academicYear) {
      toast.error('Academic Year is required for export');
      return;
    }

    setExportLoading(true);
    try {
      const isComplete = exportForm.exportType === 'complete';

      const res = await admissionService.listApplications({
        page: 1,
        limit: 100000,
        status: exportForm.status === 'ALL' ? (status === 'ALL' ? undefined : status) : exportForm.status,
        branchId: exportForm.branchId === 'ALL' ? (branchId === 'ALL' ? undefined : branchId) : exportForm.branchId,
        admissionType: exportForm.admissionType === 'ALL' ? (admissionType === 'ALL' ? undefined : admissionType) : exportForm.admissionType,
        qualification: exportForm.qualification === 'ALL' ? (qualification === 'ALL' ? undefined : qualification) : exportForm.qualification,
        gender: gender === 'ALL' ? undefined : gender,
        category: category === 'ALL' ? undefined : category,
        district: district.trim() || undefined,
        academicYear: exportForm.academicYear === 'ALL' ? (academicYear === 'ALL' ? undefined : academicYear) : exportForm.academicYear,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
        includeFullDetails: isComplete,
      });

      const matchedRows = res.applications;

      if (!matchedRows || matchedRows.length === 0) {
        toast.warning('No matching students found for the selected export criteria.');
        setExportLoading(false);
        return;
      }

      const branchObj = branches.find(b => b.id === exportForm.branchId);
      const branchCode = exportForm.branchId === 'ALL' ? 'ALL' : (branchObj?.code || 'BRANCH');
      const branchName = exportForm.branchId === 'ALL' ? 'All Branches' : (branchObj?.name || 'Branch');
      const statusLabel = exportForm.status === 'ALL' ? 'All Statuses' : exportForm.status;

      const filterMeta: ExportFilterMetadata = {
        academicYear: exportForm.academicYear,
        branchName,
        branchCode,
        statusLabel,
        admissionType: exportForm.admissionType,
        qualification: exportForm.qualification,
        gender,
        category,
        district,
        startDate,
        endDate,
        search,
      };

      generateStudentReport(matchedRows, exportForm.exportType, exportForm.format, filterMeta);

      toast.success(`Successfully exported ${matchedRows.length} student record(s) as ${exportForm.format.toUpperCase()}`);
      setExportModalOpen(false);
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error(err.response?.data?.error || 'Failed to generate student export report.');
    } finally {
      setExportLoading(false);
    }
  };

  const getTimelineBadge = (title: string, date: string | null) => {
    if (!date) return null;
    return (
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          <div className="size-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center border border-violet-200 dark:border-violet-800 shrink-0">
            <CheckCircle2 size={16} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="w-0.5 h-12 bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div className="space-y-1 pt-1">
          <p className="text-xs font-bold text-neutral-800 dark:text-white">{title}</p>
          <p className="text-[10px] font-semibold text-neutral-400">{new Date(date).toLocaleString()}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Total Students Card */}
        <button
          onClick={() => {
            setStatus('ALL');
            setPage(1);
          }}
          className="p-3.5 rounded-2xl border text-left transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col justify-between h-20 w-48 bg-neutral-900 border-neutral-950 text-white dark:bg-neutral-950 dark:border-neutral-900 hover:scale-[1.01]"
        >
          <div className="flex justify-between items-start w-full">
            <span className="text-[10px] font-black uppercase tracking-wider leading-none opacity-75">Total Students</span>
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-auto">
            <span className="text-xl font-black leading-none">{stats.enrolled}</span>
            <span className="text-[9px] font-bold opacity-60">students</span>
          </div>
        </button>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {!readOnly && stats.cancelled > 0 && (
            <button 
              onClick={() => setDeleteModalOpen(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white transition-colors rounded-xl shadow-md flex items-center gap-1.5 text-xs font-bold"
            >
              <Trash2 size={14} /> Delete Cancelled Records
            </button>
          )}
          <button 
            onClick={() => {
              const prefix = location.pathname.startsWith('/principal') ? '/principal' : '/admin';
              navigate(`${prefix}/student-export`);
            }}
            className="px-4 py-2.5 bg-violet-600 text-white hover:bg-violet-700 transition-colors rounded-xl shadow-md flex items-center gap-2 text-xs font-bold"
          >
            <Download size={14} /> Export Students
          </button>
          <button onClick={handleRefresh} className="p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 transition-colors shadow-sm flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Branch Tabs Row */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
          Quick Filter by Branch
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scroll-smooth">
          {/* 'All Branches' Tab */}
          <button
            onClick={() => {
              setBranchId('ALL');
              setPendingBranchId('ALL');
              setPage(1);
            }}
            className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[80px] h-10 flex items-center justify-center text-xs font-black shadow-sm ${
              branchId === 'ALL'
                ? 'bg-violet-600 border-violet-700 text-white'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">ALL</span>
          </button>

          {/* Dynamic Branch Tabs */}
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setBranchId(b.id);
                setPendingBranchId(b.id);
                setPage(1);
              }}
              className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[80px] h-10 flex items-center justify-center text-xs font-black shadow-sm ${
                branchId === b.id
                  ? 'bg-violet-600 border-violet-700 text-white'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
              }`}
              title={b.name}
            >
              <span className="w-full text-center leading-none">{b.code}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Semester Tabs Row */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
          Quick Filter by Semester
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scroll-smooth">
          {/* 'All Semesters' Tab */}
          <button
            onClick={() => {
              setSemester('ALL');
              setPendingSemester('ALL');
              setPage(1);
            }}
            className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[75px] h-10 flex items-center justify-center text-xs font-black shadow-sm ${
              semester === 'ALL'
                ? 'bg-blue-600 border-blue-700 text-white'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">ALL SEM</span>
          </button>

          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <button
              key={s}
              onClick={() => {
                setSemester(s.toString());
                setPendingSemester(s.toString());
                setPage(1);
              }}
              className={`px-3 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[75px] h-10 flex items-center justify-center text-xs font-black shadow-sm ${
                semester === s.toString()
                  ? 'bg-blue-600 border-blue-700 text-white'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
              }`}
            >
              <span className="w-full text-center leading-none">Sem {s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-800">

        {/* Search Row */}
        <div className="px-5 py-3.5 flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800">
          {/* Boxed search input */}
          <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400 transition-all">
            <Search className="shrink-0 text-neutral-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, application no., phone, email, Aadhaar, USN..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleExecuteSearch();
                }
              }}
              className="flex-1 bg-transparent text-sm text-neutral-800 dark:text-white placeholder:text-neutral-400 outline-none font-medium"
            />
            {pendingSearch && (
              <button
                type="button"
                onClick={() => {
                  setPendingSearch('');
                  setSearch('');
                  setPage(1);
                }}
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 transition-colors text-xs font-bold cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleExecuteSearch}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Search size={14} />
            Search
          </button>
          <ShowStudentsRangeSelector
            value={limit}
            onChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </div>

        {showFilters && (
          <div className="px-5 pt-4 pb-5 space-y-4">

            {/* Row 1: Primary dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-x-3.5 gap-y-3">
              {/* Academic Year */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Academic Year</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </span>
                  <select
                    value={academicYear}
                    onChange={(e) => {
                      setPendingAcademicYear(e.target.value);
                      setAcademicYear(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Years</option>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const y = 2026 + i;
                      const opt = `${y}-${y + 1}`;
                      return <option key={opt} value={opt}>{opt}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* Batch */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Batch</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <Layers size={12} />
                  </span>
                  <select
                    value={batch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPendingBatch(val);
                      setBatch(val);
                      setPage(1);
                    }}
                    className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Batches</option>
                    {availableBatches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Semester */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Semester</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <GraduationCap size={12} />
                  </span>
                  <select
                    value={semester}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPendingSemester(val);
                      setSemester(val);
                      setPage(1);
                    }}
                    className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Semesters</option>
                    <option value="1">1st Semester</option>
                    <option value="2">2nd Semester</option>
                    <option value="3">3rd Semester</option>
                    <option value="4">4th Semester</option>
                    <option value="5">5th Semester</option>
                    <option value="6">6th Semester</option>
                    <option value="7">7th Semester</option>
                    <option value="8">8th Semester</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Status</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </span>
                  <select
                    value={status}
                    onChange={(e) => {
                      setPendingStatus(e.target.value);
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="APPROVED">Verified (Admin)</option>
                    <option value="PRINCIPAL_APPROVED">Principal Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="ENROLLED">Admission Confirmed</option>
                    <option value="CANCELLATION_REQUESTED">Cancellation Requested</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Admission Type */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Admission Type</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </span>
                  <select
                    value={admissionType}
                    onChange={(e) => {
                      setPendingAdmissionType(e.target.value);
                      setAdmissionType(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Types</option>
                    <option value="KCET">KCET</option>
                    <option value="DCET">DCET (Lateral)</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="COMEDK">COMEDK</option>
                  </select>
                </div>
              </div>

              {/* Qualification */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Qualification</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                  </span>
                  <select
                    value={qualification}
                    onChange={(e) => {
                      setPendingQualification(e.target.value);
                      setQualification(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Qualifications</option>
                    <option value="PUC">PUC / 12th</option>
                    <option value="DIPLOMA">Diploma</option>
                  </select>
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Gender</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                  </span>
                  <select
                    value={gender}
                    onChange={(e) => {
                      setPendingGender(e.target.value);
                      setGender(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-7 pr-2 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Genders</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2: Category + District + Date Range + Sort By */}
            <div className="flex flex-wrap items-end gap-x-5 gap-y-4">

              {/* Category */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setPendingCategory(e.target.value);
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                  className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer min-w-[130px] h-[36px]"
                >
                  <option value="ALL">All Categories</option>
                  <option value="GM">GM (General Merit)</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="2A">2A</option>
                  <option value="2B">2B</option>
                  <option value="3A">3A</option>
                  <option value="3B">3B</option>
                  <option value="C1">C1</option>
                </select>
              </div>

              {/* District */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 whitespace-nowrap">District</label>
                <input
                  type="text"
                  placeholder="e.g. Belagavi"
                  value={pendingDistrict}
                  onChange={(e) => setPendingDistrict(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 w-32 placeholder:text-neutral-400 h-[36px]"
                />
              </div>

              {/* Submitted Date Range */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Submitted Date Range</label>
                <div className="flex items-center gap-2 h-[36px]">
                  <input
                    type="date"
                    value={pendingStartDate}
                    onChange={(e) => setPendingStartDate(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 h-full"
                  />
                  <span className="text-xs font-semibold text-neutral-400">to</span>
                  <input
                    type="date"
                    value={pendingEndDate}
                    onChange={(e) => setPendingEndDate(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 h-full"
                  />
                </div>
              </div>

              {/* Sort By */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Sort By</label>
                <div className="flex items-center gap-2 h-[36px]">
                  <select
                    value={pendingSortBy}
                    onChange={(e) => setPendingSortBy(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer h-full"
                  >
                    <option value="date">Date Submitted</option>
                    <option value="rank">Application Number</option>
                    <option value="name">Student Name</option>
                    <option value="updatedAt">Last Updated</option>
                  </select>
                  <button
                    onClick={() => setPendingSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                    className="flex items-center gap-1 px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 transition-colors whitespace-nowrap h-full"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                    {pendingSortOrder === 'DESC' ? 'Newest' : 'Oldest'}
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom: Reset + Apply Filters */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={() => {
                  setPendingSearch(''); setPendingAcademicYear('ALL'); setPendingBatch('ALL'); setPendingBranchId('ALL');
                  setPendingSemester('ALL'); setPendingStatus('ENROLLED'); setPendingAdmissionType('ALL'); setPendingQualification('ALL');
                  setPendingGender('ALL'); setPendingCategory('ALL'); setPendingDistrict('');
                  setPendingStartDate(''); setPendingEndDate('');
                  setPendingSortBy('date'); setPendingSortOrder('DESC');
                  setSearch(''); setAcademicYear('ALL'); setBatch('ALL'); setBranchId('ALL'); setSemester('ALL');
                  setStatus('ENROLLED'); setAdmissionType('ALL'); setQualification('ALL');
                  setGender('ALL'); setCategory('ALL'); setDistrict('');
                  setStartDate(''); setEndDate(''); setSortBy('date'); setSortOrder('DESC'); setPage(1);
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-neutral-900 text-rose-500 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
                Reset Filters
              </button>
              <button
                onClick={() => {
                  setSearch(pendingSearch); setAcademicYear(pendingAcademicYear); setBatch(pendingBatch);
                  setBranchId(pendingBranchId); setSemester(pendingSemester); setStatus(pendingStatus);
                  setAdmissionType(pendingAdmissionType); setQualification(pendingQualification);
                  setGender(pendingGender); setCategory(pendingCategory);
                  setDistrict(pendingDistrict); setStartDate(pendingStartDate);
                  setEndDate(pendingEndDate); setSortBy(pendingSortBy);
                  setSortOrder(pendingSortOrder); setPage(1);
                }}
                className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>



      {/* Student Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-violet-600" size={32} />
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Loading student records...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-20 text-center space-y-3">
            <ClipboardList className="mx-auto text-neutral-300 dark:text-neutral-700" size={48} />
            <h3 className="text-base font-extrabold text-neutral-800 dark:text-white">No Student Records Found</h3>
            <p className="text-xs font-semibold text-neutral-500 max-w-md mx-auto">
              There are no student applications matching the filters. Try adjusting your filter parameters or search keyword.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[1260px]">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
                <tr className="border-b border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white">
                  <th className="py-4 px-3 text-center w-12 text-white">Sl No</th>
                  <th className="py-4 px-3 text-white min-w-[160px]">App No / USN</th>
                  <th className="py-4 px-4 text-white min-w-[220px]">Student Name</th>
                  <th className="py-4 px-3 text-center text-white min-w-[90px]">Branch</th>
                  <th className="py-4 px-3 text-center text-white min-w-[90px]">Semester</th>
                  <th className="py-4 px-3 text-white min-w-[110px]">Type</th>
                  <th className="py-4 px-3 text-white min-w-[100px]">Qual</th>
                  <th className="py-4 px-3 text-white min-w-[140px]">Mobile Number</th>
                  <th className="py-4 px-3 text-white min-w-[120px]">Status</th>
                  <th className="py-4 px-3 text-white min-w-[160px]">Submitted Date</th>
                  <th className="py-4 px-3 text-white min-w-[160px]">Last Updated</th>
                  <th className="py-4 px-3 text-right text-white min-w-[120px] pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/40 text-xs font-semibold">
                {students.map((app, idx) => {
                  const pd = app.studentpersonaldetails;

                  return (
                    <tr key={app.id} className="hover:bg-neutral-50/40 dark:hover:bg-neutral-800/10 transition-colors">
                      <td className="py-4 px-3 text-center text-neutral-400 font-bold">
                        {(page - 1) * 10 + idx + 1}
                      </td>
                      <td className="py-4 px-3 font-bold whitespace-nowrap min-w-[160px]">
                        <button
                          onClick={() => handleViewStudent(app.id)}
                          className="hover:underline text-left text-neutral-800 hover:text-orange-600 dark:text-neutral-200 dark:hover:text-orange-400 transition-colors font-mono"
                        >
                          {app.applicationStatus === 'ENROLLED' ? app.user?.student?.enrollmentNumber || app.applicationNumber : app.applicationNumber}
                        </button>
                      </td>
                      <td className="py-4 px-4 font-bold whitespace-nowrap min-w-[220px]">
                        <button
                          onClick={() => handleViewStudent(app.id)}
                          className="hover:underline text-left text-neutral-900 hover:text-orange-600 dark:text-white dark:hover:text-orange-400 transition-colors"
                        >
                          {pd
                            ? `${pd.firstName} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName}`.replace(/\s+/g, ' ').trim()
                            : app.user
                              ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim()
                              : 'N/A'
                          }
                        </button>
                      </td>
                      <td className="py-4 px-3 font-extrabold text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        {app.branch?.code || 'N/A'}
                      </td>
                      <td className="py-4 px-3 text-center whitespace-nowrap">
                        {app.user?.student?.semester
                          ? <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black border border-indigo-100 dark:border-indigo-900">
                              Sem {app.user.student.semester}
                            </span>
                          : <span className="text-neutral-400 font-semibold">—</span>
                        }
                      </td>
                      <td className="py-4 px-3 font-bold whitespace-nowrap">
                        {app.admissionType || 'N/A'}
                      </td>
                      <td className="py-4 px-3 font-bold text-neutral-500 whitespace-nowrap">
                        {app.qualification || 'N/A'}
                      </td>
                      <td className="py-4 px-3 text-neutral-500 whitespace-nowrap">
                        {pd?.phone || app.user?.phone || 'N/A'}
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${STATUS_COLOR_MAP[app.applicationStatus] || STATUS_COLOR_MAP.DRAFT}`}>
                          {STATUS_LABEL_MAP[app.applicationStatus] || app.applicationStatus}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-neutral-400 whitespace-nowrap">
                        {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-4 px-3 text-neutral-400 whitespace-nowrap">
                        {new Date(app.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleViewStudent(app.id)}
                            className="p-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors"
                            title="View Profile"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => handleDownloadPDF(app.id)}
                            className="p-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors"
                            title="Download PDF"
                          >
                            <Download size={14} />
                          </button>
                          {!readOnly && (
                            <button 
                              onClick={() => {
                                const prefix = location.pathname.startsWith('/principal') ? '/principal' : '/admin';
                                navigate(`${prefix}/students/view/${app.id}?edit=true`);
                              }}
                              className="p-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
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

        {/* Pagination bar */}
        {!loading && students.length > 0 && (
          <div className="p-4 border-t border-neutral-150 dark:border-neutral-800/40 flex items-center justify-between text-xs font-bold text-neutral-500">
            <span>Showing page {page} of {totalPages} ({totalCount} total students)</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="p-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 rounded-xl"
              >
                <ChevronLeft size={14} />
              </button>
              <button 
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="p-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 rounded-xl"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {exportModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 animate-in fade-in duration-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold uppercase tracking-wider text-neutral-900 dark:text-white">Export Student Database</h3>
              <button onClick={() => setExportModalOpen(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                <X size={18} className="text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleExportSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Academic Year <span className="text-rose-500">*</span></label>
                <select 
                  value={exportForm.academicYear}
                  onChange={(e) => setExportForm(prev => ({ ...prev, academicYear: e.target.value }))}
                  required
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                >
                  {Array.from({ length: 5 }).map((_, i) => {
                    const y = new Date().getFullYear() + i;
                    const opt = `${y}-${y + 1}`;
                    return <option key={opt} value={opt}>{opt}</option>;
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Branch</label>
                <select 
                  value={exportForm.branchId}
                  onChange={(e) => setExportForm(prev => ({ ...prev, branchId: e.target.value }))}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Status</label>
                  <select 
                    value={exportForm.status}
                    onChange={(e) => setExportForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="APPROVED">Verified (Admin)</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="ENROLLED">Enrolled</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Admission Type</label>
                  <select 
                    value={exportForm.admissionType}
                    onChange={(e) => setExportForm(prev => ({ ...prev, admissionType: e.target.value }))}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="ALL">All Types</option>
                    <option value="KCET">KCET</option>
                    <option value="DCET">DCET</option>
                    <option value="MANAGEMENT">MANAGEMENT</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Export Type</label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setExportForm(prev => ({ ...prev, exportType: 'summary' }))}
                    className={`py-2 px-3 text-xs font-bold border rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${exportForm.exportType === 'summary' ? 'bg-violet-600 border-violet-600 text-white shadow-md' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-750 text-neutral-700 dark:text-neutral-350 hover:bg-neutral-100'}`}
                  >
                    <span>Summary Report</span>
                    <span className="text-[9px] opacity-75 font-semibold">Compact 15 columns</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportForm(prev => ({ ...prev, exportType: 'complete' }))}
                    className={`py-2 px-3 text-xs font-bold border rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${exportForm.exportType === 'complete' ? 'bg-violet-600 border-violet-600 text-white shadow-md' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-750 text-neutral-700 dark:text-neutral-350 hover:bg-neutral-100'}`}
                  >
                    <span>Complete Report</span>
                    <span className="text-[9px] opacity-75 font-semibold">Full 360° All Fields</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Export Format</label>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'Excel (.xlsx)', value: 'excel' as const },
                    { label: 'CSV', value: 'csv' as const },
                    { label: 'PDF', value: 'pdf' as const },
                  ].map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setExportForm(prev => ({ ...prev, format: f.value }))}
                      className={`py-2 px-3 text-xs font-bold border rounded-xl transition-all ${exportForm.format === f.value ? 'bg-violet-600 border-violet-600 text-white shadow-md' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-750 text-neutral-700 dark:text-neutral-350 hover:bg-neutral-100'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={exportLoading}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 transition-colors text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {exportLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Exporting Database...
                  </>
                ) : (
                  <>
                    <Download size={14} /> Start Export Download
                  </>
                )}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Student Modal */}
      {editModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold uppercase tracking-wider text-neutral-900 dark:text-white">Modify Student Application</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                <X size={18} className="text-neutral-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">First Name</label>
                  <input 
                    type="text" 
                    value={editForm.firstName}
                    disabled
                    className="w-full bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-not-allowed opacity-75"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Last Name</label>
                  <input 
                    type="text" 
                    value={editForm.lastName}
                    disabled
                    className="w-full bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-not-allowed opacity-75"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Email Address</label>
                <input 
                  type="email" 
                  value={editForm.email}
                  disabled
                  className="w-full bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-not-allowed opacity-75"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Application Status</label>
                <select 
                  value={editForm.applicationStatus}
                  onChange={(e) => setEditForm(prev => ({ ...prev, applicationStatus: e.target.value }))}
                  className="w-full bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="APPROVED">Verified (Admin)</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="ENROLLED">Enrolled</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Remarks / Internal notes</label>
                <textarea 
                  rows={3}
                  value={editForm.adminRemarks}
                  onChange={(e) => setEditForm(prev => ({ ...prev, adminRemarks: e.target.value }))}
                  placeholder="Enter remarks for verification status change..."
                  className="w-full bg-neutral-50 dark:bg-neutral-855 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <button 
                onClick={handleSaveEdit}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 transition-colors text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md"
              >
                Save Status Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Direct Cancel Admission Modal (Two-Step Workflow) */}
      {cancelDirectModalOpen && selectedStudent && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-200">
            
            {cancelDirectStep === 1 ? (
              <>
                {/* Modal Title */}
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <Ban className="text-rose-600" size={20} /> Cancel Admission
                  </h3>
                  <button 
                    onClick={() => {
                      setCancelDirectModalOpen(false);
                      setCancelDirectReason('');
                      setCancelDirectRemarks('');
                      setCancelDirectStep(1);
                    }}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Display Student Details */}
                <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Student Name</p>
                    <p className="font-extrabold text-neutral-900 dark:text-white mt-0.5">
                      {selectedStudent.user ? `${selectedStudent.user.firstName || ''} ${selectedStudent.user.lastName || ''}`.trim() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Admission Number</p>
                    <p className="font-extrabold text-neutral-900 dark:text-white mt-0.5">{selectedStudent.applicationNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Branch</p>
                    <p className="font-bold text-neutral-800 dark:text-neutral-200 mt-0.5">{selectedStudent.branch?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Admission Type</p>
                    <p className="font-bold text-neutral-800 dark:text-neutral-200 mt-0.5">{selectedStudent.admissionType || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Current Status</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40">
                      Admission Confirmed
                    </span>
                  </div>
                </div>

                {/* Reason & Remarks Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={cancelDirectReason}
                      onChange={(e) => setCancelDirectReason(e.target.value)}
                      className="w-full text-xs font-semibold bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-neutral-950 dark:text-white transition-colors"
                    >
                      <option value="">Select a reason</option>
                      <option value="Student Joined Another College">Student Joined Another College</option>
                      <option value="Student Did Not Report">Student Did Not Report</option>
                      <option value="Fee Not Paid">Fee Not Paid</option>
                      <option value="Documents Not Submitted">Documents Not Submitted</option>
                      <option value="Duplicate Admission">Duplicate Admission</option>
                      <option value="Requested Offline">Requested Offline</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">
                      Remarks
                    </label>
                    <textarea
                      value={cancelDirectRemarks}
                      onChange={(e) => setCancelDirectRemarks(e.target.value)}
                      rows={3}
                      placeholder="Optional administrative notes..."
                      className="w-full text-xs font-semibold p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-neutral-950 dark:text-white transition-all resize-none"
                    />
                  </div>

                  {/* Information Box */}
                  <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-4 space-y-2 text-xs">
                    <p className="font-extrabold text-amber-900 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                      This action will ONLY change the student's admission status to: <strong>Admission Cancelled</strong>
                    </p>
                    <p className="font-bold text-amber-800 dark:text-amber-350 text-[11px]">The following WILL NOT be deleted:</p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-300">
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Student Profile</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Personal Details</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Academic Details</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Uploaded Documents</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Admission History</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Timeline</span>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setCancelDirectModalOpen(false);
                      setCancelDirectReason('');
                      setCancelDirectRemarks('');
                      setCancelDirectStep(1);
                    }}
                    className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-350 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!cancelDirectReason}
                    onClick={() => setCancelDirectStep(2)}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-rose-600/10 flex items-center gap-1.5"
                  >
                    Proceed <ArrowRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Final Confirmation Modal */}
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <h3 className="text-base font-black text-rose-600 dark:text-rose-400 uppercase tracking-wide flex items-center gap-2">
                    <AlertTriangle size={20} className="text-rose-600" /> Final Confirmation
                  </h3>
                  <button 
                    onClick={() => setCancelDirectStep(1)}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <p className="text-sm font-extrabold text-neutral-900 dark:text-white">
                    Are you sure you want to cancel this student's admission?
                  </p>

                  <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-xl p-4 space-y-2.5">
                    <div>
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Student</p>
                      <p className="font-extrabold text-neutral-900 dark:text-white text-xs mt-0.5">
                        {selectedStudent.applicationNumber} — {selectedStudent.user ? `${selectedStudent.user.firstName || ''} ${selectedStudent.user.lastName || ''}`.trim() : 'N/A'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rose-100 dark:border-rose-900/30">
                      <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Current Status</p>
                        <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">Admission Confirmed</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">New Status</p>
                        <p className="font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">Admission Cancelled</p>
                      </div>
                    </div>

                    <p className="text-[11px] font-bold text-rose-700 dark:text-rose-350 italic pt-1">
                      ℹ This action does NOT delete the student.
                    </p>
                  </div>
                </div>

                {/* Step 2 Buttons */}
                <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    disabled={cancelDirectSubmitting}
                    onClick={() => setCancelDirectStep(1)}
                    className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-350 transition-colors disabled:opacity-50"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    disabled={cancelDirectSubmitting}
                    onClick={handleDirectCancelSubmit}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-rose-600/10 flex items-center gap-1.5"
                  >
                    {cancelDirectSubmitting ? 'Cancelling...' : 'Yes, Cancel Admission'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>,
        document.body
      )}

      {/* Delete Cancelled Modal */}
      {deleteModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-black text-rose-600 dark:text-rose-400 uppercase tracking-wide flex items-center gap-2">
                <Trash2 size={20} className="text-rose-600" /> Permanently Delete Cancelled Records?
              </h3>
              <button 
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteInput('');
                }} 
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-neutral-600 dark:text-neutral-400 font-semibold leading-relaxed">
              <p>
                This will permanently delete all cancelled admission records, associated student accounts, uploaded documents, academic information and related data.
              </p>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-400">
                <AlertTriangle className="shrink-0 mt-0.5 text-rose-600" size={16} />
                <p className="font-extrabold">Warning: This action cannot be undone.</p>
              </div>
              <div className="space-y-1.5 pt-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  Type <span className="font-black text-rose-600">DELETE</span> to confirm
                </label>
                <input 
                  type="text" 
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                disabled={deleteSubmitting}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteInput('');
                }}
                className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-350 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deleteSubmitting || deleteInput !== 'DELETE'}
                onClick={handleBulkDeleteCancelled}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-rose-600/10 flex items-center gap-1.5"
              >
                {deleteSubmitting ? (
                  <>Deletes Processing...</>
                ) : (
                  <>Confirm Delete</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentsDashboardPage;
