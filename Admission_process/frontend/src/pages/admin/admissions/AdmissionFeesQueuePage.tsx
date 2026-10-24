import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import admissionService, { AdmissionApplication, AdmissionListResult } from '../../../services/admission.service';
import { 
  Search, Filter, ChevronLeft, ChevronRight, Eye, CheckCircle2, Clock, XCircle, FileText, 
  RefreshCw, CreditCard, Send, ShieldCheck, SlidersHorizontal, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { ShowStudentsRangeSelector } from '../../../components/common/ShowStudentsRangeSelector';

export const AdmissionFeesQueuePage: React.FC = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<AdmissionListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  
  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusTab, setStatusTab] = useState<string>('FEE_RECEIPT_UPLOADED');
  const [branchId, setBranchId] = useState('ALL');
  const [admissionType, setAdmissionType] = useState('ALL');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Stats
  const [stats, setStats] = useState({
    approved: 0,           // Payment Pending
    feeReceiptUploaded: 0, // Receipt Uploaded
    feeVerified: 0,        // Fee Verified / Forwarded
    enrolled: 0,           // History / Confirmed
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
      const result = await admissionService.listApplications({
        page,
        limit,
        status: statusTab,
        branchId: branchId === 'ALL' ? undefined : branchId,
        admissionType: admissionType === 'ALL' ? undefined : admissionType,
        search,
        sortBy,
        sortOrder
      });
      setData(result);
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
    fetchApplications();
  }, [page, limit, statusTab, branchId, admissionType, sortBy, sortOrder, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const getStatusBadge = (appStatus: string) => {
    switch (appStatus) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600" /> Payment Pending
          </span>
        );
      case 'FEE_RECEIPT_UPLOADED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200 animate-pulse">
            <CreditCard className="w-3 h-3 mr-1 text-cyan-600" /> Receipt Uploaded
          </span>
        );
      case 'FEE_VERIFIED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <ShieldCheck className="w-3 h-3 mr-1 text-sky-600" /> Fee Verified & Forwarded
          </span>
        );
      case 'ENROLLED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Admission Confirmed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {appStatus}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-violet-900 via-purple-900 to-indigo-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-amber-400 text-slate-950 uppercase">
              Physical Fee Verification
            </span>
            <span className="text-xs font-bold text-violet-200">JCER College Office</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">💰 Admission Fees Dashboard</h1>
          <p className="text-xs text-violet-200 max-w-2xl leading-relaxed">
            Verify official paper fee receipts uploaded by students after physical office payment of ₹500. Approved fee receipts will be forwarded directly to the Principal for final sign-off.
          </p>
        </div>
      </div>

      {/* Top Dashboard Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Payment Pending */}
        <button
          onClick={() => { setStatusTab('APPROVED'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between ${
            statusTab === 'APPROVED'
              ? 'bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white border-neutral-200/70 hover:border-neutral-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Payment Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-neutral-900">{stats.approved || 0}</span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              ₹500 Pending
            </span>
          </div>
        </button>

        {/* Receipt Uploaded */}
        <button
          onClick={() => { setStatusTab('FEE_RECEIPT_UPLOADED'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between ${
            statusTab === 'FEE_RECEIPT_UPLOADED'
              ? 'bg-cyan-500/10 border-cyan-500 shadow-md ring-2 ring-cyan-500/20'
              : 'bg-white border-neutral-200/70 hover:border-neutral-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Receipt Uploaded</span>
            <CreditCard className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-neutral-900">{stats.feeReceiptUploaded || 0}</span>
            {(stats.feeReceiptUploaded || 0) > 0 && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                {stats.feeReceiptUploaded} Waiting
              </span>
            )}
          </div>
        </button>

        {/* Fee Verified */}
        <button
          onClick={() => { setStatusTab('FEE_VERIFIED'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between ${
            statusTab === 'FEE_VERIFIED'
              ? 'bg-sky-500/10 border-sky-500 shadow-md ring-2 ring-sky-500/20'
              : 'bg-white border-neutral-200/70 hover:border-neutral-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Fee Verified</span>
            <ShieldCheck className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-neutral-900">{stats.feeVerified || 0}</span>
          </div>
        </button>

        {/* Forwarded to Principal */}
        <button
          onClick={() => { setStatusTab('FEE_VERIFIED'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between ${
            statusTab === 'FEE_VERIFIED'
              ? 'bg-violet-500/10 border-violet-500 shadow-md ring-2 ring-violet-500/20'
              : 'bg-white border-neutral-200/70 hover:border-neutral-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Forwarded to Principal</span>
            <Send className="w-4 h-4 text-violet-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-neutral-900">{stats.feeVerified || 0}</span>
          </div>
        </button>

        {/* History / All */}
        <button
          onClick={() => { setStatusTab('ALL'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between ${
            statusTab === 'ALL'
              ? 'bg-slate-500/10 border-slate-500 shadow-md ring-2 ring-slate-500/20'
              : 'bg-white border-neutral-200/70 hover:border-neutral-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">History / All</span>
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-neutral-900">{stats.total || 0}</span>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-200/70 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search Application ID or Name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-violet-500 focus:bg-white transition-all"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Department Filter */}
          <select
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 focus:outline-none focus:border-violet-500"
          >
            <option value="ALL">All Departments</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
            ))}
          </select>

          {/* Admission Type Filter */}
          <select
            value={admissionType}
            onChange={(e) => { setAdmissionType(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 focus:outline-none focus:border-violet-500"
          >
            <option value="ALL">All Admission Types</option>
            <option value="KCET">KCET</option>
            <option value="DCET">DCET</option>
            <option value="MANAGEMENT">Management</option>
          </select>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
            className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-100 flex items-center space-x-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}</span>
          </button>

          <ShowStudentsRangeSelector
            value={limit}
            onChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/70 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-violet-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-neutral-500">Loading fee records...</p>
          </div>
        ) : !data || data.applications.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <CreditCard className="w-12 h-12 text-neutral-300 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-800">No applications found</h3>
            <p className="text-xs text-neutral-400">There are no fee receipt records in this queue view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-neutral-200/60 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Application ID</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4">Department / Branch</th>
                  <th className="py-3.5 px-4">Uploaded Date</th>
                  <th className="py-3.5 px-4">Current Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {data.applications.map((app) => {
                  const pd = app.studentpersonaldetails;
                  const studentName = pd
                    ? `${pd.firstName} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName}`.replace(/\s+/g, ' ').trim()
                    : app.user
                      ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim()
                      : 'N/A';

                  const uploadedDate = app.feeReceiptUploadedAt || app.updatedAt;

                  return (
                    <tr key={app.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-neutral-900">
                        {app.applicationNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-black text-[10px]">
                            {studentName.charAt(0) || 'S'}
                          </div>
                          <div>
                            <p className="font-bold text-neutral-800">{studentName}</p>
                            <p className="text-[10px] text-neutral-400">{app.user?.email || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-neutral-700">{app.branch?.name || app.branch?.code || 'Unassigned'}</span>
                        <span className="block text-[10px] text-neutral-400">{app.admissionType}</span>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-500">
                        {uploadedDate ? format(new Date(uploadedDate), 'dd MMM yyyy, hh:mm a') : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(app.applicationStatus)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate(`/admin/admissions/fee-review/${app.id}`)}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-colors inline-flex items-center space-x-1.5 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.totalPages > 1 && (
          <div className="p-4 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-semibold">
              Showing Page {data.page} of {data.totalPages} ({data.total} Total)
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-2 rounded-xl border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, data.totalPages))}
                disabled={page === data.totalPages}
                className="p-2 rounded-xl border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdmissionFeesQueuePage;
