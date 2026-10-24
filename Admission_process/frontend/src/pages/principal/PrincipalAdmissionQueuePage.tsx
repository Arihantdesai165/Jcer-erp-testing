import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import API from '../../services/api';
import { AdmissionApplication, AdmissionListResult } from '../../services/admission.service';
import {
  Search, ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, FileText,
  RefreshCw, Eye, Filter, Calendar, User, GraduationCap, ShieldCheck, Inbox,
  CheckCheck, AlertCircle, X, Loader2, Info
} from 'lucide-react';
import { toast } from 'react-toastify';
import { ShowStudentsRangeSelector } from '../../components/common/ShowStudentsRangeSelector';
import { useAcademicYear } from '../../context/AcademicYearContext';

interface PrincipalAdmissionQueuePageProps {
  defaultStatus?: string;
}

interface BulkConfirmSummary {
  requested: number;
  confirmed: number;
  skipped: number;
  failed: number;
  results?: Array<{
    admissionId: string;
    admissionNumber?: string;
    studentName?: string;
    previousStatus?: string;
    newStatus?: string;
    result: 'CONFIRMED' | 'SKIPPED' | 'FAILED';
    reason?: string;
  }>;
}

export const PrincipalAdmissionQueuePage: React.FC<PrincipalAdmissionQueuePageProps> = ({ defaultStatus = 'APPROVED' }) => {
  const navigate = useNavigate();
  const { academicYears: availableAcademicYears } = useAcademicYear();

  const getRouteForStatus = (tabStatus: string) => {
    switch (tabStatus) {
      case 'APPROVED': return '/principal/admissions/pending';
      case 'ENROLLED': return '/principal/admissions/approved';
      case 'REJECTED': return '/principal/admissions/rejected';
      case 'ALL': return '/principal/admissions/history';
      default: return '/principal/admissions/pending';
    }
  };

  const [data, setData] = useState<AdmissionListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  // Selection & Bulk Approval States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [summaryData, setSummaryData] = useState<BulkConfirmSummary | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState<string>(defaultStatus);
  const [branchId, setBranchId] = useState('ALL');
  const [admissionType, setAdmissionType] = useState('ALL');
  const [qualification, setQualification] = useState('ALL');
  const [academicYear, setAcademicYear] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Stats
  const [stats, setStats] = useState({
    approved: 0,
    enrolled: 0,
    rejected: 0,
    total: 0
  });

  const loadInitialData = async () => {
    try {
      const [statsRes, branchRes] = await Promise.all([
        API.get('/principal/admissions/stats'),
        API.get('/branches')
      ]);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (branchRes.data.data) setBranches(branchRes.data.data);
    } catch (e) {
      console.error('Failed to load initial data', e);
    }
  };

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', String(limit));
      if (status) query.set('status', status);
      if (branchId !== 'ALL') query.set('branchId', branchId);
      if (admissionType !== 'ALL') query.set('admissionType', admissionType);
      if (qualification !== 'ALL') query.set('qualification', qualification);
      if (academicYear !== 'ALL') query.set('academicYear', academicYear);
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);
      if (search) query.set('search', search);
      if (sortBy) query.set('sortBy', sortBy);
      if (sortOrder) query.set('sortOrder', sortOrder);

      const res = await API.get(`/principal/admissions/list?${query.toString()}`);
      if (res.data.success) {
        setData(res.data.data as AdmissionListResult);
      }
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

  useEffect(() => {
    setStatus(defaultStatus);
    setPage(1);
    setSelectedIds([]);
  }, [defaultStatus]);

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line
  }, [page, limit, status, branchId, admissionType, qualification, academicYear, startDate, endDate, search, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setBranchId('ALL');
    setAdmissionType('ALL');
    setQualification('ALL');
    setAcademicYear('ALL');
    setStartDate('');
    setEndDate('');
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const isEligibleForApproval = (app: AdmissionApplication) => {
    return app.applicationStatus === 'APPROVED' || app.applicationStatus === 'FEE_VERIFIED';
  };

  const eligibleAppsOnPage = data?.applications.filter(isEligibleForApproval) || [];
  const isAllEligibleSelected = eligibleAppsOnPage.length > 0 && eligibleAppsOnPage.every(a => selectedIds.includes(a.id));

  const handleToggleSelectAll = () => {
    if (isAllEligibleSelected) {
      // Deselect all on this page
      const pageEligibleIds = new Set(eligibleAppsOnPage.map(a => a.id));
      setSelectedIds(prev => prev.filter(id => !pageEligibleIds.has(id)));
    } else {
      // Add all eligible on this page
      const newIds = new Set([...selectedIds, ...eligibleAppsOnPage.map(a => a.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelectRow = (id: string, isEligible: boolean) => {
    if (!isEligible) return;
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenConfirmModal = () => {
    if (selectedIds.length === 0) {
      toast.info('Please select at least one admission to confirm.');
      return;
    }
    setConfirmModalOpen(true);
  };

  const handleExecuteBulkConfirm = async () => {
    if (selectedIds.length === 0) return;
    setConfirming(true);

    try {
      const res = await API.post('/principal/admissions/bulk-confirm', {
        admissionIds: selectedIds
      });

      if (res.data.success) {
        const summary = res.data.summary || {
          requested: selectedIds.length,
          confirmed: res.data.data?.filter((r: any) => r.success)?.length || selectedIds.length,
          skipped: 0,
          failed: res.data.data?.filter((r: any) => !r.success)?.length || 0,
        };

        setConfirmModalOpen(false);
        setSummaryData({
          ...summary,
          results: res.data.results
        });

        // Single clean notification
        if (summary.confirmed > 0 && summary.failed === 0) {
          toast.success(`${summary.confirmed} admission${summary.confirmed > 1 ? 's' : ''} successfully confirmed.`);
        } else if (summary.confirmed > 0 && summary.failed > 0) {
          toast.warning(`${summary.confirmed} confirmed, ${summary.failed} failed.`);
        } else if (summary.confirmed === 0 && summary.skipped > 0) {
          toast.info(`Selected admission${summary.skipped > 1 ? 's are' : ' is'} already confirmed.`);
        } else {
          toast.error('Bulk confirmation could not be processed.');
        }

        // Automatic refresh of queue, counts, and active state
        setSelectedIds([]);
        fetchApplications();
        loadInitialData();
        window.dispatchEvent(new CustomEvent('admissions-updated'));
      }
    } catch (err: any) {
      console.error('Bulk confirm error:', err);
      toast.error(err.response?.data?.error || 'Failed to confirm selected admissions.');
    } finally {
      setConfirming(false);
    }
  };

  const getStatusBadge = (appStatus: string) => {
    switch (appStatus) {
      case 'APPROVED':
      case 'FEE_VERIFIED':
        return <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold border border-amber-200">Awaiting Principal Approval</span>;
      case 'PRINCIPAL_APPROVED':
      case 'ADMISSION_CONFIRMED':
      case 'ENROLLED':
        return <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-200">Admission Confirmed</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold border border-rose-200">Returned / Rejected</span>;
      case 'CANCELLATION_REQUESTED':
        return <span className="px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 font-bold border border-orange-200">Cancellation Requested</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold border border-slate-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-bold">{appStatus}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ═══ HEADER BANNER ═══ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldCheck size={24} className="text-indigo-600" />
            Admissions Queue Workspace
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            Review Admin-verified admission files and grant final approval for enrollment.
          </p>
        </div>

        {/* Action Buttons: Bulk Approve / Confirm + Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={handleOpenConfirmModal}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            title="Approve & Enroll Selected Admissions"
          >
            <CheckCheck size={15} />
            Bulk Approve & Enroll
            {selectedIds.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-black">
                {selectedIds.length}
              </span>
            )}
          </button>

          <button
            onClick={() => fetchApplications()}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-2xl text-xs font-bold transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* ═══ QUEUE TABS (Card Style) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { 
            name: "Pending Approval", 
            status: "APPROVED", 
            count: stats.approved || 0, 
            color: "bg-amber-500",
            activeClass: "bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/50"
          },
          { 
            name: "Confirmed / Enrolled", 
            status: "ENROLLED", 
            count: stats.enrolled || 0, 
            color: "bg-emerald-500",
            activeClass: "bg-emerald-600 border-emerald-700 text-white shadow-lg shadow-emerald-600/50"
          },
          { 
            name: "Rejected", 
            status: "REJECTED", 
            count: stats.rejected || 0, 
            color: "bg-rose-500",
            activeClass: "bg-rose-600 border-rose-700 text-white shadow-lg shadow-rose-600/50"
          },
          { 
            name: "History / All", 
            status: "ALL", 
            count: stats.total || 0, 
            color: "bg-neutral-500",
            activeClass: "bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:border-white dark:text-neutral-900 shadow-lg shadow-neutral-900/40"
          }
        ].map((tab) => {
          const isActive = status === tab.status;
          return (
            <button
              key={tab.name}
              onClick={() => {
                navigate(getRouteForStatus(tab.status));
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col justify-between h-24 ${
                isActive 
                  ? tab.activeClass 
                  : 'bg-white border-neutral-200 hover:border-neutral-300 dark:bg-neutral-900 dark:border-neutral-800'
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60">{tab.name}</span>
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : tab.color}`} />
              </div>
              <div className="flex items-baseline gap-1 mt-auto">
                <span className="text-2xl font-black leading-none">{tab.count}</span>
                <span className="text-[10px] font-bold opacity-60">apps</span>
              </div>
            </button>
          );
        })}
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
              setPage(1);
            }}
            className={`px-5 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[80px] h-10 flex items-center justify-center text-xs font-black shadow-sm ${
              branchId === 'ALL'
                ? 'bg-indigo-600 border-indigo-700 text-white'
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
                setPage(1);
              }}
              className={`px-5 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[80px] h-10 flex items-center justify-center text-xs font-black shadow-sm ${
                branchId === b.id
                  ? 'bg-indigo-600 border-indigo-700 text-white'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
              }`}
              title={b.name}
            >
              <span className="w-full text-center leading-none">{b.code}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ FILTER & SEARCH BAR ═══ */}
      <div className="bg-white dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by Admission No, Student Name, Phone, CET/DCET No..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/60 rounded-2xl pl-11 pr-4 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer"
          >
            Search
          </button>
          <ShowStudentsRangeSelector
            value={limit}
            onChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-neutral-400" />
            <span className="text-[10px] font-black uppercase text-neutral-400">Filters:</span>
          </div>

          {/* Admission Type */}
          <select
            value={admissionType}
            onChange={(e) => { setAdmissionType(e.target.value); setPage(1); }}
            className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
          >
            <option value="ALL">All Quotas</option>
            <option value="KCET">KCET</option>
            <option value="DCET">DCET</option>
            <option value="MANAGEMENT">MANAGEMENT</option>
          </select>

          {/* Qualification */}
          <select
            value={qualification}
            onChange={(e) => { setQualification(e.target.value); setPage(1); }}
            className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
          >
            <option value="ALL">All Qualifications</option>
            <option value="PUC">PUC / 12th</option>
            <option value="DIPLOMA">Diploma</option>
          </select>

          {/* Academic Year */}
          <select
            value={academicYear}
            onChange={(e) => { setAcademicYear(e.target.value); setPage(1); }}
            className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
          >
            <option value="ALL">All Academic Years</option>
            {availableAcademicYears.map((ay) => (
              <option key={ay.id || ay.year} value={ay.year}>{ay.year}</option>
            ))}
          </select>

          {(branchId !== 'ALL' || admissionType !== 'ALL' || qualification !== 'ALL' || academicYear !== 'ALL' || search) && (
            <button
              onClick={clearFilters}
              className="text-xs font-bold text-rose-500 hover:underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ═══ SELECTION / ACTION BAR ═══ */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                {selectedIds.length} student{selectedIds.length > 1 ? 's' : ''} selected
              </p>
              <p className="text-[10px] text-indigo-700/80 dark:text-indigo-400 font-medium">
                Ready for Final Principal Approval & Direct ERP Enrollment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3.5 py-1.5 bg-white dark:bg-neutral-800 hover:bg-neutral-50 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold border border-neutral-200 dark:border-neutral-700 transition-all"
            >
              Cancel Selection
            </button>
            <button
              onClick={handleOpenConfirmModal}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
            >
              <CheckCheck size={14} />
              Approve & Enroll Selected
            </button>
          </div>
        </div>
      )}

      {/* ═══ TABLE / EMPTY QUEUE ═══ */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-neutral-400">Loading admission queue files...</p>
          </div>
        ) : !data || data.applications.length === 0 ? (
          <div className="py-20 px-4 text-center flex flex-col items-center justify-center space-y-4">
            <div className="size-20 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-400 flex items-center justify-center border border-slate-200 dark:border-neutral-700">
              <Inbox size={36} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-neutral-800 dark:text-neutral-200">
                No applications found in this queue
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm">
                There are currently no student applications matching your active filters or selected status queue.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#111111] dark:bg-neutral-950 text-white font-extrabold uppercase text-[11px] tracking-wider border-b border-neutral-800">
                    <th className="py-3.5 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isAllEligibleSelected}
                        onChange={handleToggleSelectAll}
                        disabled={eligibleAppsOnPage.length === 0}
                        className="size-4 rounded border-neutral-600 bg-neutral-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title={eligibleAppsOnPage.length === 0 ? 'No eligible admissions to select on this page' : 'Select all eligible on this page'}
                      />
                    </th>
                    <th className="py-3.5 px-4">Admission No</th>
                    <th className="py-3.5 px-6">Student Name</th>
                    <th className="py-3.5 px-4">Branch</th>
                    <th className="py-3.5 px-4">Quota</th>
                    <th className="py-3.5 px-4">CET / DCET No</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.applications.map((app) => {
                    const pd = app.studentpersonaldetails;
                    const studentName = pd
                      ? `${pd.firstName} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName}`.replace(/\s+/g, ' ').trim()
                      : app.user
                        ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim()
                        : 'Guest Applicant';
                    const isEligible = isEligibleForApproval(app);
                    const isSelected = selectedIds.includes(app.id);

                    return (
                      <tr 
                        key={app.id} 
                        className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors ${
                          isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(app.id, isEligible)}
                            disabled={!isEligible}
                            className="size-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isEligible ? 'Select for bulk approval & enrollment' : 'Not eligible for Principal approval'}
                          />
                        </td>
                        <td className="py-4 px-4 font-black">
                          <button
                            onClick={() => navigate(`/principal/admissions/review/${app.id}`)}
                            className="hover:underline text-left text-neutral-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400 transition-colors"
                          >
                            {app.applicationNumber}
                          </button>
                        </td>
                        <td className="py-4 px-6 font-bold">
                          <button
                            onClick={() => navigate(`/principal/admissions/review/${app.id}`)}
                            className="hover:underline text-left text-neutral-800 hover:text-indigo-600 dark:text-neutral-200 dark:hover:text-indigo-400 transition-colors"
                          >
                            {studentName}
                          </button>
                        </td>
                        <td className="py-4 px-4 font-extrabold text-indigo-600 dark:text-indigo-400">
                          {app.branch?.code || 'N/A'}
                        </td>
                        <td className="py-4 px-4 font-bold text-neutral-600">
                          {app.admissionType || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-neutral-500 font-medium">
                          {app.cetNumber || app.dcetNumber || 'N/A'}
                        </td>
                        <td className="py-4 px-6">
                          {getStatusBadge(app.applicationStatus)}
                        </td>
                        <td className="py-4 px-4 text-neutral-400 font-medium">
                          {app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => navigate(`/principal/admissions/review/${app.id}`)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ml-auto"
                          >
                            <Eye size={14} />
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Dynamic Count Summary Bar (Outside & Below Table) ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/90 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-850/70 text-xs text-slate-600 dark:text-neutral-300 shadow-2xs select-none">
              <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
                <span>
                  Total: <strong className="font-extrabold text-slate-900 dark:text-white">{data.total}</strong> student{data.total === 1 ? '' : 's'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span>
                  Selected: <strong className="font-extrabold text-indigo-600 dark:text-indigo-400">{selectedIds.length}</strong> of {data.applications.length}
                </span>
              </div>
            </div>

            {/* ═══ PAGINATION ═══ */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                <span className="text-neutral-500 font-medium">
                  Page {data.page} of {data.totalPages} ({data.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={data.page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 rounded-xl disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 rounded-xl disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ CONFIRMATION DIALOG MODAL ═══ */}
      {confirmModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="size-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShieldCheck size={26} />
              </div>
              <button
                onClick={() => !confirming && setConfirmModalOpen(false)}
                disabled={confirming}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Approve & Enroll Selected Admissions?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                You are about to approve and directly enroll <strong className="text-slate-800 dark:text-slate-200">{selectedIds.length}</strong> selected student{selectedIds.length > 1 ? 's' : ''} into the ERP system.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-neutral-800/60 rounded-2xl border border-slate-100 dark:border-neutral-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">Status Transition</span>
                <span className="text-emerald-600 font-extrabold">AWAITING → ENROLLED</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                This will grant final Principal approval and directly enroll the selected students into the ERP system.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={confirming}
                className="px-5 py-2.5 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkConfirm}
                disabled={confirming}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
              >
                {confirming ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  <>
                    <CheckCheck size={14} />
                    Approve & Enroll
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ SUMMARY / RESULTS MODAL ═══ */}
      {summaryData && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="size-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={26} />
              </div>
              <button
                onClick={() => setSummaryData(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Bulk Approval & Enrollment Completed
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                The Principal approval queue has been updated and students have been enrolled in ERP.
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-neutral-800/60 p-4 rounded-2xl border border-slate-100 dark:border-neutral-800 text-xs">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                <span>✓ Enrolled in ERP</span>
                <span className="font-extrabold text-sm">{summaryData.confirmed}</span>
              </div>
              {summaryData.skipped > 0 && (
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 font-bold">
                  <span>○ Already Enrolled / Skipped</span>
                  <span className="font-extrabold text-sm">{summaryData.skipped}</span>
                </div>
              )}
              {summaryData.failed > 0 && (
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 font-bold">
                  <span>✕ Failed</span>
                  <span className="font-extrabold text-sm">{summaryData.failed}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSummaryData(null)}
                className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PrincipalAdmissionQueuePage;
