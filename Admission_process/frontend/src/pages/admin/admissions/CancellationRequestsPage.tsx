import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import admissionService, { AdmissionApplication, AdmissionListResult } from '../../../services/admission.service';
import { 
  Search, Eye, CheckCircle2, Clock, XCircle, X, AlertTriangle, ArrowRight, CornerDownLeft, Ban,
  ArrowLeft, User, FileText, Building, Calendar, ShieldAlert, Send, Loader2, GraduationCap, Info, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { ShowStudentsRangeSelector } from '../../../components/common/ShowStudentsRangeSelector';

export const CancellationRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AdmissionListResult | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Page View Modes: 'LIST' | 'DECISION' | 'VIEW_DETAILS'
  const [viewMode, setViewMode] = useState<'LIST' | 'DECISION' | 'VIEW_DETAILS'>('LIST');

  // Selected student and action state
  const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);
  const [processAction, setProcessAction] = useState<'APPROVE' | 'REJECT'>('REJECT');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const result = await admissionService.listApplications({
        page,
        limit,
        status: 'CANCELLATION_REQUESTED',
        search
      });
      setData(result);
    } catch (error) {
      console.error('Failed to fetch cancellation requests', error);
      toast.error('Failed to fetch cancellation requests list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [page, limit, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleOpenDecisionPage = (app: AdmissionApplication, action: 'APPROVE' | 'REJECT') => {
    setSelectedApp(app);
    setProcessAction(action);
    setAdminRemarks('');
    setViewMode('DECISION');
  };

  const handleOpenViewPage = (app: AdmissionApplication) => {
    setSelectedApp(app);
    setViewMode('VIEW_DETAILS');
  };

  const handleProcessSubmit = async (overrideAction?: 'APPROVE' | 'REJECT') => {
    if (!selectedApp) return;
    const finalAction = overrideAction || processAction;
    setActionSubmitting(true);
    try {
      await admissionService.processCancellation(selectedApp.id, finalAction, adminRemarks);
      toast.success(
        finalAction === 'APPROVE'
          ? 'Admission cancellation approved successfully.'
          : 'Cancellation request rejected. Admission status restored to Confirmed.'
      );
      setViewMode('LIST');
      setSelectedApp(null);
      setAdminRemarks('');
      fetchApplications();
    } catch (error: any) {
      console.error('Error processing cancellation:', error);
      toast.error(error.response?.data?.error || 'Failed to process cancellation request.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy, hh:mm a');
    } catch (e) {
      return dateStr;
    }
  };

  const getStudentName = (app: AdmissionApplication) => {
    if (app.studentpersonaldetails) {
      const { firstName, middleName, lastName } = app.studentpersonaldetails;
      return `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.replace(/\s+/g, ' ').trim();
    }
    if (app.user) {
      return `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim();
    }
    return 'N/A';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DEDICATED CANCELLATION PROCESS PAGE (viewMode === 'DECISION')
  // ═══════════════════════════════════════════════════════════════════════════
  if (viewMode === 'DECISION' && selectedApp) {
    const studentName = getStudentName(selectedApp);

    return (
      <div className="animate-fade-in space-y-6 p-4 sm:p-6 max-w-5xl mx-auto min-h-screen text-neutral-800 dark:text-neutral-100 pb-16">
        {/* Navigation Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            className="flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to Cancellation Queue</span>
          </button>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
              processAction === 'REJECT'
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
            }`}>
              {processAction === 'REJECT' ? 'Decision Mode: Rejection' : 'Decision Mode: Approval'}
            </span>
          </div>
        </div>

        {/* Page Title */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              processAction === 'REJECT' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
            }`}>
              {processAction === 'REJECT' ? <Ban size={22} /> : <CheckCircle2 size={22} />}
            </div>
            {processAction === 'REJECT' ? 'Reject Admission Cancellation Request' : 'Approve Admission Cancellation Request'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 font-medium pl-13">
            Review student request details and confirm your administrative decision.
          </p>
        </div>

        {/* Main 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Student File Summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
              
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 font-black text-lg flex items-center justify-center border border-violet-100 dark:border-violet-900">
                    {studentName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white leading-tight">{studentName}</h3>
                    <p className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 mt-0.5">
                      Admission No: {selectedApp.applicationNumber || 'N/A'}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] font-extrabold rounded-full border border-amber-200/60 dark:border-amber-900/50 uppercase tracking-wider">
                  Pending Review
                </span>
              </div>

              {/* Student Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <span className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider block">Branch / Department</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 mt-1 block">{selectedApp.branch?.name || 'N/A'}</span>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <span className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider block">Admission Type</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 mt-1 block">{selectedApp.admissionType || 'N/A'}</span>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider block">Requested Date</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 mt-1 block">{formatDate(selectedApp.cancellationRequestedAt)}</span>
                </div>
              </div>

              {/* Cancellation Reason Box */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider block">Reason for Cancellation Request</span>
                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-4 rounded-2xl">
                  <span className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                    {selectedApp.cancellationReason || 'No reason specified'}
                  </span>
                </div>
              </div>

              {/* Student Remarks */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider block">Student Remarks / Additional Notes</span>
                <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800 p-4 rounded-2xl text-xs font-medium italic text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {selectedApp.cancellationRemarks ? `"${selectedApp.cancellationRemarks}"` : 'No additional remarks provided by the student.'}
                </div>
              </div>

            </div>
          </div>

          {/* Right 1 Col: Decision & Action Form */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-5 sticky top-6">
              
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={18} className="text-violet-600" />
                  Administrative Decision
                </h3>
                <p className="text-[11px] text-neutral-400 font-medium mt-1">Select action &amp; enter decision justification.</p>
              </div>

              {/* Action Toggle Switch */}
              <div className="grid grid-cols-2 gap-2 bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-2xl text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => setProcessAction('REJECT')}
                  className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    processAction === 'REJECT'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  <Ban size={14} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => setProcessAction('APPROVE')}
                  className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    processAction === 'APPROVE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
              </div>

              {/* Impact Warning Box */}
              <div className={`p-4 rounded-2xl border text-xs font-semibold space-y-1.5 ${
                processAction === 'REJECT'
                  ? 'bg-rose-50/70 text-rose-900 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50'
                  : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50'
              }`}>
                <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider">
                  <ShieldAlert size={14} />
                  <span>Decision Impact</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {processAction === 'REJECT'
                    ? "Rejecting this request will decline the student's cancellation and restore their status back to Admission Confirmed (ENROLLED)."
                    : "Approving this request will permanently cancel the student's admission and update their status to Admission Cancelled."}
                </p>
              </div>

              {/* Administrator Remarks Input */}
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider">
                  Administrator Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder="Enter remarks or justification for this decision..."
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-3.5 text-xs font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  disabled={actionSubmitting}
                  onClick={() => handleProcessSubmit()}
                  className={`w-full py-3.5 text-white rounded-2xl text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                    processAction === 'REJECT'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  }`}
                >
                  {actionSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Processing Decision...</span>
                    </>
                  ) : (
                    <>
                      {processAction === 'REJECT' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                      <span>{processAction === 'REJECT' ? 'CONFIRM REJECTION' : 'CONFIRM APPROVAL'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('LIST')}
                  disabled={actionSubmitting}
                  className="w-full py-3 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-2xl text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Cancel &amp; Return to Queue
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEDICATED VIEW DETAILS PAGE (viewMode === 'VIEW_DETAILS')
  // ═══════════════════════════════════════════════════════════════════════════
  if (viewMode === 'VIEW_DETAILS' && selectedApp) {
    const studentName = getStudentName(selectedApp);

    return (
      <div className="animate-fade-in space-y-6 p-4 sm:p-6 max-w-4xl mx-auto min-h-screen text-neutral-800 dark:text-neutral-100 pb-16">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            className="flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to Cancellation Queue</span>
          </button>
          <span className="px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded-full text-[11px] font-extrabold uppercase tracking-wider border border-amber-200/60 dark:border-amber-900/50">
            Cancellation Details
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <div>
              <h2 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-wide">{studentName}</h2>
              <p className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 mt-0.5">
                Admission No: {selectedApp.applicationNumber}
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-50 text-amber-600 dark:bg-amber-950/20 text-xs font-black rounded-full uppercase tracking-wider border border-amber-200 dark:border-amber-900">
              Pending Cancellation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
            <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Branch / Stream</span>
              <span className="text-neutral-900 dark:text-white font-bold mt-1 block">{selectedApp.branch?.name || 'N/A'}</span>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Admission Type</span>
              <span className="text-neutral-900 dark:text-white font-bold mt-1 block">{selectedApp.admissionType || 'N/A'}</span>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Cancellation Reason</span>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-extrabold rounded-md text-[11px] uppercase">
                {selectedApp.cancellationReason || 'N/A'}
              </span>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Requested Date</span>
              <span className="text-neutral-900 dark:text-white font-bold mt-1 block">{formatDate(selectedApp.cancellationRequestedAt)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Student Remarks</span>
            <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-xs font-medium italic text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
              {selectedApp.cancellationRemarks ? `"${selectedApp.cancellationRemarks}"` : 'No remarks provided.'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setViewMode('LIST')}
              className="w-full sm:w-auto px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-350 transition-colors"
            >
              Back to Queue
            </button>
            <button
              onClick={() => handleOpenDecisionPage(selectedApp, 'REJECT')}
              className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Ban size={14} /> Reject Cancellation
            </button>
            <button
              onClick={() => handleOpenDecisionPage(selectedApp, 'APPROVE')}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={14} /> Approve Cancellation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN CANCELLATION QUEUE LIST (viewMode === 'LIST')
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-wide">
            Cancellation Requests
          </h2>
          <p className="text-xs font-bold text-neutral-450 mt-1">
            Review and process student requests for admission cancellation.
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-5">
        
        {/* Search & Range Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-3 max-w-md flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 size-4" />
              <input
                type="text"
                placeholder="Search by student name or admission number..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-neutral-900 dark:text-white transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Search
            </button>
          </form>
          <ShowStudentsRangeSelector
            value={limit}
            onChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto border border-neutral-100 dark:border-neutral-800/60 rounded-2xl shadow-xs">
          <table className="w-full text-left border-collapse text-xs min-w-[1050px]">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase font-extrabold border-b border-neutral-800">
              <tr className="border-b border-neutral-800 bg-[#111111] dark:bg-neutral-950 text-white font-black uppercase tracking-wider text-[10px]">
                <th className="p-4 text-white min-w-[160px]">Admission No</th>
                <th className="p-4 text-white min-w-[220px]">Student Name</th>
                <th className="p-4 text-white min-w-[120px]">Branch</th>
                <th className="p-4 text-white min-w-[120px]">Admission Type</th>
                <th className="p-4 text-white min-w-[140px]">Reason</th>
                <th className="p-4 text-white min-w-[150px]">Requested Date</th>
                <th className="p-4 text-white min-w-[140px]">Status</th>
                <th className="p-4 text-right text-white min-w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/40 text-neutral-700 dark:text-neutral-350 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400 italic">
                    Loading requests...
                  </td>
                </tr>
              ) : !data || data.applications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400 italic">
                    No cancellation requests found.
                  </td>
                </tr>
              ) : (
                data.applications.map((app) => (
                  <tr key={app.id} className="hover:bg-neutral-50/40 dark:hover:bg-neutral-900/10 transition-colors">
                    <td className="p-4 font-bold text-neutral-900 dark:text-white whitespace-nowrap">
                      {app.applicationNumber}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {getStudentName(app)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {app.branch?.name || 'N/A'}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {app.admissionType || 'N/A'}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-md font-bold text-[10px] whitespace-nowrap">
                        {app.cancellationReason || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-500 whitespace-nowrap">
                      {formatDate(app.cancellationRequestedAt)}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-405 whitespace-nowrap">
                        Pending Cancellation
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenViewPage(app)}
                        className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-350 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} /> View
                      </button>
                      <button
                        onClick={() => handleOpenDecisionPage(app, 'APPROVE')}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleOpenDecisionPage(app, 'REJECT')}
                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-neutral-400">
              Page {data.page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-lg text-neutral-500 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page === data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-lg text-neutral-500 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default CancellationRequestsPage;
