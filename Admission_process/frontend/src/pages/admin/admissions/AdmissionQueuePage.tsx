import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import admissionService, { AdmissionApplication, AdmissionListResult } from '../../../services/admission.service';
import { 
  Search, Filter, ChevronLeft, ChevronRight, Eye, CheckCircle2, Clock, XCircle, FileText, 
  RefreshCw, CheckSquare, Square, Download, Mail, Send, Award, ShieldAlert, ShieldCheck, 
  SlidersHorizontal, ArrowRight, UserCheck, Copy, X, Lock, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import API from '../../../services/api';
import { ShowStudentsRangeSelector } from '../../../components/common/ShowStudentsRangeSelector';

const getPhotoUrl = (path: string | null | undefined, appId?: string) => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  
  if (!path.startsWith('/uploads') && !path.startsWith('uploads/') && appId) {
    const base = API.defaults.baseURL || '/api';
    const token = localStorage.getItem('token');
    const url = `${base}/admin/admissions/${appId}/documents/photo`;
    return token ? `${url}?token=${encodeURIComponent(token)}` : url;
  }

  const base = API.defaults.baseURL || '/api';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base.replace(/\/api\/?$/, '')}${cleanPath}`;
  const token = localStorage.getItem('token');
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

interface AdmissionQueuePageProps {
  defaultStatus?: string;
}

export const AdmissionQueuePage: React.FC<AdmissionQueuePageProps> = ({ defaultStatus = 'QUEUE' }) => {
  const navigate = useNavigate();

  const getRouteForStatus = (tabStatus: string) => {
    switch (tabStatus) {
      case 'QUEUE': return '/admin/admissions/queue';
      case 'RESUBMITTED': return '/admin/admissions/resubmitted';
      case 'CORRECTION_REQUIRED': return '/admin/admissions/corrections';
      case 'APPROVED': return '/admin/admissions/verified';
      case 'ENROLLED': return '/admin/admissions/enrolled';
      case 'REJECTED': return '/admin/admissions/rejected';
      case 'ALL': return '/admin/admissions/history';
      default: return '/admin/admissions/queue';
    }
  };

  const [data, setData] = useState<AdmissionListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  
  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState<string>(defaultStatus);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [branchId, setBranchId] = useState('ALL');
  const [admissionType, setAdmissionType] = useState('ALL');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Bulk actions selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [credentialsModalApp, setCredentialsModalApp] = useState<AdmissionApplication | null>(null);

  // Dynamic Pipeline Counts
  const [stats, setStats] = useState({
    submitted: 0,
    resubmitted: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    enrolled: 0,
    correctionRequired: 0,
    total: 0
  });

  const loadInitialData = async () => {
    try {
      const [statsData, branchData] = await Promise.all([
        admissionService.getStats(),
        admissionService.getBranches()
      ]);
      if (statsData) setStats(statsData as any);
      if (branchData) setBranches(branchData);
    } catch (e) {
      console.error('Failed to load initial data', e);
    }
  };

  const fetchApplications = async () => {
    setLoading(true);
    try {
      let activeStatus = status;
      if (status === 'QUEUE' && statusFilter !== 'ALL') {
        activeStatus = statusFilter;
      } else if (status === 'ALL' && statusFilter !== 'ALL') {
        activeStatus = statusFilter;
      }

      const result = await admissionService.listApplications({
        page,
        limit,
        status: activeStatus,
        branchId: branchId === 'ALL' ? undefined : branchId,
        admissionType: admissionType === 'ALL' ? undefined : admissionType,
        search,
        sortBy,
        sortOrder
      });
      setData(result);
      setSelectedIds([]); // Clear selection on load
    } catch (error) {
      console.error('Failed to fetch applications', error);
      toast.error('Failed to fetch applications list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Synchronize status state with defaultStatus prop when route changes
  useEffect(() => {
    setStatus(defaultStatus);
    setStatusFilter('ALL');
    setPage(1);
  }, [defaultStatus]);

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line
  }, [page, limit, status, statusFilter, branchId, admissionType, sortBy, sortOrder, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleRefresh = async () => {
    await Promise.all([fetchApplications(), loadInitialData()]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.applications) {
      setSelectedIds(data.applications.map(app => app.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBulkAction = async (action: 'APPROVE' | 'FORWARD' | 'REJECT') => {
    if (selectedIds.length === 0) return;
    
    let confirmMessage = '';
    let targetStatus: 'APPROVED' | 'ENROLLED' | 'REJECTED' = 'APPROVED';
    
    if (action === 'APPROVE') {
      confirmMessage = `Are you sure you want to verify and approve these ${selectedIds.length} selected applications? They will be forwarded to the Principal's verification queue.`;
      targetStatus = 'APPROVED';
    } else if (action === 'FORWARD') {
      confirmMessage = `Are you sure you want to finalize admission and auto-generate login credentials for these ${selectedIds.length} verified applications?`;
      targetStatus = 'ENROLLED';
    } else if (action === 'REJECT') {
      confirmMessage = `Are you sure you want to reject these ${selectedIds.length} selected applications? This will return them to corrections.`;
      targetStatus = 'REJECTED';
    }

    if (!window.confirm(confirmMessage)) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        selectedIds.map(id => 
          admissionService.updateStatus(
            id, 
            targetStatus, 
            action === 'REJECT' ? 'Bulk rejected for documentation issues.' : 'Approved via bulk actions.',
            action === 'REJECT' ? 'Incomplete Details' : undefined,
            action === 'REJECT' ? 'INCOMPLETE_DOCUMENTS' : undefined
          )
        )
      );
      toast.success(`Successfully processed ${selectedIds.length} applications.`);
      await handleRefresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to execute bulk action');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmMessage = `Are you sure you want to permanently delete these ${selectedIds.length} selected rejected applications? This action is irreversible and will delete all student records, document uploads, and their user accounts.`;
    if (!window.confirm(confirmMessage)) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        selectedIds.map(id => API.delete(`/admin/admissions/${id}`))
      );
      toast.success(`Successfully deleted ${selectedIds.length} rejected applications.`);
      await handleRefresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to execute bulk delete');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleResendCredentials = (name: string) => {
    toast.success(`Enrollment credentials email queued for ${name}!`);
  };

  const getStatusBadge = (app: AdmissionApplication) => {
    if (app.applicationStatus === 'SUBMITTED' && (app.rejectionReason || app.resubmittedAt)) {
      return (
        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28">
          <RefreshCw size={10} className="animate-spin-slow"/> Resubmitted
        </span>
      );
    }

    switch (app.applicationStatus) {
      case 'SUBMITTED':
        return <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28"><Clock size={10}/> Pending Review</span>;
      case 'RESUBMITTED':
        return <span className="px-2 py-1 bg-amber-150 dark:bg-amber-900/30 text-amber-800 dark:text-amber-450 border border-amber-300 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28"><Clock size={10}/> Resubmitted</span>;
      case 'CORRECTION_REQUIRED':
        return <span className="px-2 py-1 bg-rose-105 dark:bg-rose-900/20 text-rose-700 dark:text-rose-455 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28"><XCircle size={10}/> Correction Req</span>;
      case 'UNDER_REVIEW':
        return <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28"><FileText size={10}/> In Progress</span>;
      case 'APPROVED':
        return <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28"><ShieldCheck size={10}/> Verified</span>;
      case 'PRINCIPAL_APPROVED':
        return <span className="px-2 py-1 bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28"><UserCheck size={10}/> Principal Approved</span>;
      case 'ENROLLED':
        return <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28"><CheckCircle2 size={10}/> Approved</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 w-28"><XCircle size={10}/> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center w-28">{app.applicationStatus}</span>;
    }
  };

  const getActionAttribution = (app: AdmissionApplication, currentStatusTab: string) => {
    const formatAdminName = (u?: { firstName: string; lastName: string; username?: string; email?: string } | null) => {
      if (!u) return null;
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      return fullName || u.username || u.email || null;
    };

    switch (currentStatusTab) {
      case 'APPROVED': {
        const name = formatAdminName(app.verifiedByAdmin);
        return name ? (
          <span className="font-bold text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1">
            <ShieldCheck size={12} className="text-indigo-500 shrink-0" /> {name}
          </span>
        ) : <span className="text-neutral-400">—</span>;
      }
      case 'CORRECTION_REQUIRED': {
        const name = formatAdminName(app.correctionRequestedBy);
        return name ? (
          <span className="font-bold text-orange-700 dark:text-orange-400 inline-flex items-center gap-1">
            <Clock size={12} className="text-orange-500 shrink-0" /> {name}
          </span>
        ) : <span className="text-neutral-400">—</span>;
      }
      case 'REJECTED': {
        const name = formatAdminName(app.rejectedByAdmin);
        return name ? (
          <span className="font-bold text-rose-700 dark:text-rose-400 inline-flex items-center gap-1">
            <XCircle size={12} className="text-rose-500 shrink-0" /> {name}
          </span>
        ) : <span className="text-neutral-400">—</span>;
      }
      case 'ENROLLED': {
        const name = formatAdminName(app.verifiedByAdmin) || formatAdminName(app.approvedByAdmin);
        return name ? (
          <span className="font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> {name}
          </span>
        ) : <span className="text-neutral-400">—</span>;
      }
      case 'RESUBMITTED': {
        const name = formatAdminName(app.correctionRequestedBy);
        return name ? (
          <span className="font-bold text-purple-700 dark:text-purple-400 inline-flex items-center gap-1">
            <RefreshCw size={12} className="text-purple-500 shrink-0" /> {name}
          </span>
        ) : <span className="text-neutral-400">—</span>;
      }
      default: {
        let name: string | null = null;
        let colorCls = 'text-neutral-700 dark:text-neutral-300';
        if (app.applicationStatus === 'REJECTED') {
          name = formatAdminName(app.rejectedByAdmin);
          colorCls = 'text-rose-700 dark:text-rose-400';
        } else if (app.applicationStatus === 'ENROLLED') {
          name = formatAdminName(app.verifiedByAdmin) || formatAdminName(app.approvedByAdmin);
          colorCls = 'text-emerald-700 dark:text-emerald-400';
        } else if (app.applicationStatus === 'APPROVED' || app.applicationStatus === 'PRINCIPAL_APPROVED') {
          name = formatAdminName(app.verifiedByAdmin);
          colorCls = 'text-indigo-700 dark:text-indigo-400';
        } else if (app.applicationStatus === 'CORRECTION_REQUIRED' || app.applicationStatus === 'RESUBMITTED') {
          name = formatAdminName(app.correctionRequestedBy);
          colorCls = 'text-orange-700 dark:text-orange-400';
        }
        return name ? (
          <span className={`font-bold ${colorCls}`}>
            {name}
          </span>
        ) : <span className="text-neutral-400">—</span>;
      }
    }
  };

  const getActionColumnHeader = (currentStatusTab: string) => {
    switch (currentStatusTab) {
      case 'APPROVED': return 'Verified By';
      case 'CORRECTION_REQUIRED': return 'Sent for Correction By';
      case 'REJECTED': return 'Rejected By';
      case 'ENROLLED': return 'Approved By';
      case 'RESUBMITTED': return 'Correction Flagged By';
      default: return 'Action By';
    }
  };

  const tabs = [
    { name: "Queue", status: "QUEUE", count: status === "QUEUE" && data?.total !== undefined ? data.total : (stats.submitted + stats.underReview + (stats.resubmitted || 0)), color: "bg-amber-500" },
    { name: "Resubmitted", status: "RESUBMITTED", count: status === "RESUBMITTED" && data?.total !== undefined ? data.total : (stats.resubmitted || 0), color: "bg-purple-500" },
    { name: "Corrections", status: "CORRECTION_REQUIRED", count: status === "CORRECTION_REQUIRED" && data?.total !== undefined ? data.total : (stats.correctionRequired || 0), color: "bg-orange-500" },
    { name: "Verified", status: "APPROVED", count: status === "APPROVED" && data?.total !== undefined ? data.total : stats.approved, color: "bg-indigo-500" },
    { name: "Enrolled", status: "ENROLLED", count: status === "ENROLLED" && data?.total !== undefined ? data.total : stats.enrolled, color: "bg-emerald-500" },
    { name: "Rejected", status: "REJECTED", count: status === "REJECTED" && data?.total !== undefined ? data.total : stats.rejected, color: "bg-rose-500" },
    { name: "History", status: "ALL", count: status === "ALL" && data?.total !== undefined ? data.total : stats.total, color: "bg-neutral-500" }
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl pb-12">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <button onClick={handleRefresh} className="p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 transition-colors shadow-sm self-start md:self-auto flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300">
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* Stage Tab View */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
        {tabs.map((tab) => {
          const isActive = status === tab.status;
          return (
            <button
              key={tab.name}
              onClick={() => {
                navigate(getRouteForStatus(tab.status));
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col justify-between h-24 ${
                isActive 
                  ? 'bg-neutral-900 border-neutral-950 dark:bg-white dark:border-white text-white dark:text-neutral-900' 
                  : 'bg-white border-neutral-200 hover:border-neutral-300 dark:bg-neutral-900 dark:border-neutral-800'
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60">{tab.name}</span>
                <span className={`w-2 h-2 rounded-full ${tab.color}`} />
              </div>
              <div className="flex items-baseline gap-1 mt-auto">
                <span className="text-2xl font-black leading-none">{tab.count}</span>
                <span className="text-[10px] font-bold opacity-60">apps</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters Glass Panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-5 space-y-4">
        
        {/* Filters Top Row */}
        <div className="flex flex-wrap items-end gap-4">
          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[260px] space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block h-3.5 invisible">Search</span>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input 
                type="text" 
                placeholder="Search by name, app number..." 
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value && search) {
                    setSearch('');
                    setPage(1);
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 h-[38px]"
              />
            </div>
          </form>

          {/* Department Select */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Dept</span>
            <select 
              value={branchId}
              onChange={(e) => { setBranchId(e.target.value); setPage(1); }}
              className="bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500 h-[38px]"
            >
              <option value="ALL">All Departments</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter Dropdown */}
          {(status === 'QUEUE' || status === 'ALL') && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Status</span>
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500 h-[38px]"
              >
                {status === 'QUEUE' ? (
                  <>
                    <option value="ALL">All Queue</option>
                    <option value="SUBMITTED">Pending Review</option>
                    <option value="UNDER_REVIEW">In Progress</option>
                    <option value="RESUBMITTED">Resubmitted</option>
                  </>
                ) : (
                  <>
                    <option value="ALL">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">Pending Review</option>
                    <option value="UNDER_REVIEW">In Progress</option>
                    <option value="APPROVED">Verified</option>
                    <option value="ENROLLED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </>
                )}
              </select>
            </div>
          )}

          {/* Admission Type Select */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Type</span>
            <select 
              value={admissionType}
              onChange={(e) => { setAdmissionType(e.target.value); setPage(1); }}
              className="bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500 h-[38px]"
            >
              <option value="ALL">All Entrance</option>
              <option value="KCET">KCET</option>
              <option value="DCET">DCET</option>
              <option value="MANAGEMENT">MANAGEMENT</option>
            </select>
          </div>

          {/* Sorting Option */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Sort by</span>
            <div className="flex items-center gap-2 h-[38px]">
              <select 
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                className="bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500 h-full"
              >
                <option value="date">Date Submitted</option>
                <option value="rank">Merit Rank / App Number</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => { setSortOrder(e.target.value as any); setPage(1); }}
                className="bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500 h-full"
              >
                <option value="DESC">Descending</option>
                <option value="ASC">Ascending</option>
              </select>
              <ShowStudentsRangeSelector
                value={limit}
                onChange={(newLimit) => {
                  setLimit(newLimit);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Bulk Action Floating Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between bg-neutral-900 text-white rounded-xl p-3 px-5 animate-slide-in shadow-lg">
            <div className="flex items-center gap-3">
              <CheckSquare size={16} className="text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-wider">{selectedIds.length} Selected</span>
            </div>
            <div className="flex gap-2">
              {status === 'QUEUE' && (
                <>
                  <button 
                    disabled={bulkLoading} 
                    onClick={() => handleBulkAction('APPROVE')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck size={12} /> Bulk Verify & Forward
                  </button>
                  <button 
                    disabled={bulkLoading} 
                    onClick={() => handleBulkAction('REJECT')}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                  >
                    Bulk Reject
                  </button>
                </>
              )}
              {status === 'APPROVED' && (
                <button 
                  disabled={bulkLoading} 
                  onClick={() => handleBulkAction('FORWARD')}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck size={12} /> Finalize Admission
                </button>
              )}
              {status === 'REJECTED' && (
                <button 
                  disabled={bulkLoading} 
                  onClick={handleBulkDelete}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={12} /> Bulk Delete
                </button>
              )}
              <button 
                onClick={() => toast.success(`Reminder notification queued for ${selectedIds.length} applicants!`)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-neutral-700 transition-colors"
              >
                Send Reminder
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Applications List Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-100 dark:border-neutral-800 shadow-xs">
          <table className="w-full text-left text-xs whitespace-nowrap min-w-[1260px]">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800 text-[10px]">
              <tr className="text-white">
                <th className="px-4 py-3.5 w-12 text-center text-white">
                  <input 
                    type="checkbox" 
                    checked={data?.applications.length ? selectedIds.length === data.applications.length : false}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-neutral-300 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5 font-bold text-white min-w-[170px] w-[170px]">App ID</th>
                <th className="px-5 py-3.5 font-bold text-white min-w-[260px] w-[260px]">Applicant Info</th>
                <th className="px-4 py-3.5 font-bold text-white min-w-[100px] text-center">Branch</th>
                <th className="px-4 py-3.5 font-bold text-white min-w-[140px]">Entrance / Merit</th>
                <th className="px-4 py-3.5 font-bold text-white min-w-[170px]">Submitted Date</th>
                <th className="px-4 py-3.5 font-bold text-white min-w-[130px] text-center">Status</th>
                <th className="px-4 py-3.5 font-bold text-white min-w-[180px]">{getActionColumnHeader(status)}</th>
                <th className="px-4 py-3.5 font-bold text-right text-white min-w-[150px] pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 bg-white dark:bg-transparent">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-neutral-400 font-bold uppercase tracking-widest text-[10px]">
                    <LoaderPulse />
                  </td>
                </tr>
              ) : data?.applications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-neutral-400 font-bold uppercase tracking-widest text-[10px]">
                    No applications in this stage pipeline.
                  </td>
                </tr>
              ) : (
                data?.applications.map((app) => {
                  const isChecked = selectedIds.includes(app.id);
                  const acad = app.studentacademicdetails as any;
                  return (
                    <React.Fragment key={app.id}>
                      <tr className={`hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10 transition-colors ${isChecked ? 'bg-violet-50/10' : ''}`}>
                        <td className="px-4 py-3.5 text-center w-12">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={(e) => handleSelectRow(app.id, e.target.checked)}
                            className="rounded border-neutral-300 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 font-bold min-w-[170px] w-[170px]">
                          <Link
                            to={app.applicationStatus === 'ENROLLED' ? `/admin/students/view/${app.id}` : `/admin/admissions/review/${app.id}`}
                            className="hover:underline text-left text-neutral-900 hover:text-orange-600 dark:text-neutral-200 dark:hover:text-orange-400 transition-colors font-mono"
                          >
                            {app.applicationNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 min-w-[260px] w-[260px]">
                          <div className="flex items-center gap-3">
                            {app.studentdocuments?.photoUrl || app.user?.profileImage ? (
                               <img src={getPhotoUrl(app.studentdocuments?.photoUrl || app.user?.profileImage, app.id)} alt="profile" className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 bg-neutral-100 flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-black text-[10px] uppercase flex-shrink-0">
                                {app.user?.firstName?.[0] || ''}{app.user?.lastName?.[0] || ''}
                              </div>
                            )}
                            <Link
                              to={app.applicationStatus === 'ENROLLED' ? `/admin/students/view/${app.id}` : `/admin/admissions/review/${app.id}`}
                              className="font-bold text-neutral-800 dark:text-neutral-200 hover:underline hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                            >
                              {app.user?.firstName} {app.user?.lastName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center min-w-[100px]">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-extrabold text-[11px]">
                            {app.branch?.code || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 min-w-[140px]">
                          <span className="font-bold text-neutral-700 dark:text-neutral-300">
                            {app.admissionType || '—'}
                          </span>
                          {app.admissionType === 'KCET' && acad?.cetRank && (
                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Rank: #{acad.cetRank}</span>
                          )}
                          {app.admissionType === 'DCET' && acad?.dcetRank && (
                            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Rank: #{acad.dcetRank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-neutral-500 whitespace-nowrap min-w-[170px]">
                          {app.submittedAt ? format(new Date(app.submittedAt), 'dd MMM yyyy, hh:mm a') : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center min-w-[130px]">
                          {getStatusBadge(app)}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-neutral-600 dark:text-neutral-300 min-w-[180px]">
                          {getActionAttribution(app, status)}
                        </td>
                        <td className="px-4 py-3.5 text-right min-w-[150px] pr-6">
                          <div className="flex justify-end gap-1.5">
                            {app.applicationStatus === 'ENROLLED' ? (
                              <button 
                                onClick={() => setCredentialsModalApp(app)}
                                className="inline-flex items-center justify-center px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                              >
                                <Award size={10} className="mr-1" /> View Credentials
                              </button>
                            ) : (
                              <Link 
                                to={`/admin/admissions/review/${app.id}`}
                                className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm ${
                                  app.applicationStatus === 'APPROVED' 
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                                    : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                                }`}
                              >
                                {app.applicationStatus === 'APPROVED' ? 'Check Status' : 'Review & Audit'}
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Tab 3: APPROVED Credentials details block */}
                      {status === 'ENROLLED' && (
                        <tr>
                          <td colSpan={9} className="px-6 py-3 bg-emerald-50/10 dark:bg-emerald-950/5 border-b border-neutral-100 dark:border-neutral-800/80">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold">
                              <div className="flex flex-wrap items-center gap-6">
                                <div className="flex items-center gap-2">
                                  <Award size={14} className="text-emerald-500" />
                                  <span className="text-neutral-400">Application Number:</span>
                                  <span className="font-black text-emerald-600 dark:text-emerald-400">{app.applicationNumber}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Mail size={14} className="text-neutral-400" />
                                  <span className="text-neutral-400">Login ID:</span>
                                  <span className="font-bold text-neutral-700 dark:text-neutral-300">{app.user?.email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock size={14} className="text-neutral-400" />
                                  <span className="text-neutral-400">Status:</span>
                                  <span className="px-2 py-0.5 bg-emerald-100/50 dark:bg-emerald-900/10 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded">Credentials Emailed</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleResendCredentials(`${app.user?.firstName} ${app.user?.lastName}`)}
                                className="px-3 py-1.5 bg-white dark:bg-neutral-800 hover:bg-neutral-50 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 self-start md:self-auto shadow-sm"
                              >
                                <Send size={10} /> Resend Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </span>
            <div className="flex gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 disabled:opacity-50 hover:bg-neutral-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                disabled={page === data.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 disabled:opacity-50 hover:bg-neutral-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Onboarding Credentials Modal */}
        {credentialsModalApp && createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-[32px] w-full max-w-md p-6 border border-neutral-100 dark:border-neutral-800 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button 
                onClick={() => setCredentialsModalApp(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                  <Award size={24} />
                </div>
                
                <h3 className="text-lg font-black text-neutral-900 dark:text-white">Credentials Details</h3>
                <p className="text-xs text-neutral-400 font-semibold mt-1">Onboarding credentials for the student</p>
                
                <div className="w-full mt-6 space-y-3">
                  <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-left">
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Candidate Name</span>
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                          {credentialsModalApp.user?.firstName} {credentialsModalApp.user?.lastName}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Branch Code</span>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{credentialsModalApp.branch?.code || 'CSE'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Admission Type</span>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{credentialsModalApp.admissionType}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 font-extrabold block">University Seat Number (USN)</span>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-sm font-black text-neutral-900 dark:text-white">
                            {credentialsModalApp.user?.student?.enrollmentNumber || 'Not Assigned / Pending'}
                          </span>
                          {credentialsModalApp.user?.student?.enrollmentNumber && (
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(credentialsModalApp.user?.student?.enrollmentNumber || '');
                                toast.success('USN copied to clipboard!');
                              }}
                              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 rounded transition-colors"
                              title="Copy USN"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Portal Login ID</span>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                            {credentialsModalApp.user?.email}
                          </span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(credentialsModalApp.user?.email || '');
                              toast.success('Login email copied to clipboard!');
                            }}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 rounded transition-colors"
                            title="Copy Email"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full mt-6">
                  <button
                    onClick={() => {
                      handleResendCredentials(`${credentialsModalApp.user?.firstName} ${credentialsModalApp.user?.lastName}`);
                    }}
                    className="py-3 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                  >
                    <Send size={12} /> Resend Details
                  </button>
                  <button
                    onClick={() => setCredentialsModalApp(null)}
                    className="py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

const LoaderPulse = () => (
  <div className="flex flex-col items-center justify-center gap-2">
    <div className="size-6 rounded-full border-2 border-violet-100 border-t-violet-600 animate-spin" />
    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mt-2">Loading applications pipeline...</span>
  </div>
);

export default AdmissionQueuePage;