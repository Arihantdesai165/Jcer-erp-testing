import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  RefreshCw,
  Filter,
  Users,
  Clock,
  UserCheck,
  X,
  FileCheck2,
  BookOpen,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import principalService, {
  FacultyAuthRequest,
  DepartmentRecord,
  FacultyAuthDetailResponse,
} from '../../services/principal.service';
import Skeleton from '../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import { useAcademicYear } from '../../context/AcademicYearContext';

export const PrincipalFacultyAuthorizationPage: React.FC = () => {
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();

  const [requests, setRequests] = useState<FacultyAuthRequest[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedAuthority, setSelectedAuthority] = useState<string>('ALL');

  // Modal States
  const [approveModal, setApproveModal] = useState<FacultyAuthRequest | FacultyAuthDetailResponse | null>(null);
  const [rejectModal, setRejectModal] = useState<FacultyAuthRequest | FacultyAuthDetailResponse | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  const fetchDependencies = async () => {
    try {
      const depts = await principalService.getDepartments().catch(() => []);
      setDepartments(depts || []);
    } catch (err) {
      console.warn('Could not load departments for Principal authorization:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await principalService.getFacultyAuthorizations({
        search: search.trim() || undefined,
        departmentId: selectedDept === 'ALL' ? undefined : selectedDept,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        authority: selectedAuthority === 'ALL' ? undefined : selectedAuthority,
        academicYear: academicYear || '2026-27',
      });
      setRequests(Array.isArray(data) ? data : []);
      window.dispatchEvent(new CustomEvent('faculty-auth-changed'));
    } catch (err: any) {
      console.warn('Could not load faculty authorization requests:', err);
      setFetchError(err?.response?.data?.error || err?.message || 'Failed to load faculty authorization requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [selectedDept, selectedStatus, selectedAuthority, academicYear]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRequests();
  };

  const handleApproveConfirm = async () => {
    if (!approveModal) return;
    try {
      setActionProcessing(true);
      const res = await principalService.approveFacultyAuthorization(approveModal.id);
      toast.success(res?.message || 'Faculty approved successfully. Faculty account is now active.');
      setApproveModal(null);
      window.dispatchEvent(new CustomEvent('faculty-auth-changed'));
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to approve faculty request');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      toast.error('Please provide a reason for rejecting the authorization request.');
      return;
    }

    try {
      setActionProcessing(true);
      const res = await principalService.rejectFacultyAuthorization(rejectModal.id, rejectionReason.trim());
      toast.success(res?.message || 'Faculty authorization request rejected.');
      setRejectModal(null);
      setRejectionReason('');
      window.dispatchEvent(new CustomEvent('faculty-auth-changed'));
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to reject faculty request');
    } finally {
      setActionProcessing(false);
    }
  };

  // Safe KPI counts
  const totalCount = Array.isArray(requests) ? requests.length : 0;
  const pendingPrincipalCount = Array.isArray(requests)
    ? requests.filter((r) => r.status === 'PENDING').length
    : 0;
  const approvedCount = Array.isArray(requests)
    ? requests.filter((r) => r.status === 'APPROVED' || r.overallStatus === 'AUTHORIZED').length
    : 0;
  const rejectedCount = Array.isArray(requests)
    ? requests.filter((r) => r.status === 'REJECTED' || r.overallStatus === 'REJECTED').length
    : 0;

  return (
    <div className="space-y-6">

      {/* ── HEADER BANNER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                Faculty Authorization Queue
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                Review and ratify HOD faculty onboarding requests, credentials, and institutional teaching assignments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchRequests()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── KPI STATS CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Total in Scope</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white mt-1">
            {loading ? <Skeleton className="h-7 w-12" /> : totalCount}
          </div>
          <span className="text-[10px] text-neutral-400 font-medium mt-0.5 block">Filtered requests</span>
        </div>

        <div className="p-4 rounded-2xl bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-800/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
              Pending Principal Sign-off
            </span>
            <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-2xl font-black text-orange-950 dark:text-orange-200 mt-1">
            {loading ? <Skeleton className="h-7 w-12" /> : pendingPrincipalCount}
          </div>
          <span className="text-[10px] text-orange-600/80 dark:text-orange-400/80 font-medium mt-0.5 block">
            Awaiting direct ratification
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Approved
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-1">
            {loading ? <Skeleton className="h-7 w-12" /> : approvedCount}
          </div>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5 block">
            Active faculty accounts
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-800/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Rejected
            </span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-950 dark:text-rose-200 mt-1">
            {loading ? <Skeleton className="h-7 w-12" /> : rejectedCount}
          </div>
          <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-medium mt-0.5 block">
            Returned to HOD
          </span>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search faculty by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Authority Filter */}
          <select
            value={selectedAuthority}
            onChange={(e) => setSelectedAuthority(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
          >
            <option value="ALL">All Queues</option>
            <option value="PRINCIPAL">Principal Queue (Direct)</option>
            <option value="DEAN">Dean Academics Queue</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Apply</span>
          </button>
        </form>
      </div>

      {/* ── ERROR BANNER WITH RETRY (IF FAILED) ── */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => fetchRequests()}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── TABLE CARD ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span>Authorization Requests</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Institutional queue of teaching faculty submissions requiring executive authorization.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {requests.length} {requests.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#111111] dark:bg-neutral-950 text-white font-extrabold uppercase text-[11px] tracking-wider border-b border-neutral-800">
                <th className="py-3.5 px-6 font-semibold">Faculty Candidate</th>
                <th className="py-3.5 px-6 font-semibold">Department</th>
                <th className="py-3.5 px-6 font-semibold">Assigned Subject</th>
                <th className="py-3.5 px-6 font-semibold text-center">Semester</th>
                <th className="py-3.5 px-6 font-semibold">Authority</th>
                <th className="py-3.5 px-6 font-semibold">Submitted By</th>
                <th className="py-3.5 px-6 font-semibold">Submitted On</th>
                <th className="py-3.5 px-6 font-semibold text-center">Status</th>
                <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="py-4 px-6"><Skeleton className="w-36 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-32 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-14 h-4 mx-auto" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-20 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-24 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-20 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-16 h-4 mx-auto" /></td>
                    <td className="py-4 px-6 text-right"><Skeleton className="w-28 h-4 ml-auto" /></td>
                  </tr>
                ))
              ) : requests.length > 0 ? (
                requests.map((reqItem) => {
                  const isPrincipalActionable = reqItem.status === 'PENDING';
                  const isOverallAuthorized =
                    reqItem.overallStatus === 'AUTHORIZED' ||
                    reqItem.status === 'APPROVED' ||
                    reqItem.deanApproval?.status === 'APPROVED';
                  const isPrincipalApproved = reqItem.status === 'APPROVED';
                  const isDeanApproved = reqItem.deanApproval?.status === 'APPROVED';
                  const isRejected = reqItem.status === 'REJECTED' || reqItem.overallStatus === 'REJECTED';

                  const facultyDisplayName = reqItem.facultyName || 'Faculty Candidate';
                  const initialLetter = (facultyDisplayName || 'F').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={reqItem.id}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors"
                    >
                      {/* Candidate Name & Info */}
                      <td className="py-4 px-6">
                        <Link
                          to={`/principal/faculty/authorizations/${reqItem.id}`}
                          className="flex items-center space-x-3 group cursor-pointer"
                        >
                          <ProfileAvatar
                            imageUrl={reqItem.profileImage}
                            name={facultyDisplayName}
                            size="sm"
                            className="w-9 h-9 border border-orange-200/50 dark:border-orange-800/40 group-hover:scale-105 transition-transform shrink-0"
                          />
                          <div>
                            <span className="font-extrabold text-neutral-900 dark:text-white block group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                              {facultyDisplayName}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-medium">
                              {reqItem.email || 'N/A'}
                            </span>
                            {reqItem.designation && (
                              <span className="text-[9px] text-neutral-500 font-medium block">
                                {reqItem.designation}
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* Department */}
                      <td className="py-4 px-6 font-bold text-neutral-800 dark:text-neutral-200">
                        <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 text-[11px]">
                          {reqItem.departmentCode || 'N/A'}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="py-4 px-6">
                        <span className="font-bold text-neutral-900 dark:text-white block">
                          {reqItem.subjectName || 'General Assignment'}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-semibold">
                          {reqItem.subjectCode || '—'}
                        </span>
                      </td>

                      {/* Semester */}
                      <td className="py-4 px-6 text-center font-semibold text-neutral-700 dark:text-neutral-300">
                        <span>{reqItem.semester ? `Sem ${reqItem.semester}` : '—'}</span>
                      </td>

                      {/* Authority */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            reqItem.authority === 'PRINCIPAL'
                              ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-200/50 dark:border-orange-800/30'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30'
                          }`}
                        >
                          {reqItem.authority === 'PRINCIPAL' ? 'Principal Office' : 'Dean Academics'}
                        </span>
                      </td>

                      {/* Submitted By */}
                      <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400 font-medium">
                        {reqItem.createdBy || 'HOD'}
                      </td>

                      {/* Submitted On */}
                      <td className="py-4 px-6 text-neutral-500 font-medium text-[11px]">
                        {reqItem.createdDate ? new Date(reqItem.createdDate).toLocaleDateString() : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        {(() => {
                          if (isOverallAuthorized) {
                            if (isPrincipalApproved && isDeanApproved) {
                              return (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    AUTHORIZED
                                  </span>
                                  <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">Both Approved</span>
                                </div>
                              );
                            }
                            if (isPrincipalApproved) {
                              return (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    AUTHORIZED
                                  </span>
                                  <span className="text-[9px] text-neutral-500 font-medium mt-0.5">Principal Approved</span>
                                </div>
                              );
                            }
                            if (isDeanApproved) {
                              return (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
                                    <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                    AUTHORIZED
                                  </span>
                                  <span className="text-[9px] text-purple-600 font-medium mt-0.5">Approved by Dean</span>
                                </div>
                              );
                            }
                            return (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                AUTHORIZED
                              </span>
                            );
                          }

                          if (isRejected) {
                            return (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                REJECTED
                              </span>
                            );
                          }

                          return (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              PENDING REVIEW
                            </span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => navigate(`/principal/faculty/authorizations/${reqItem.id}`)}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-[11px] transition-all flex items-center space-x-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {isPrincipalActionable && (
                            <>
                              <button
                                onClick={() => setApproveModal(reqItem)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] transition-all flex items-center space-x-1 border border-emerald-500/20 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => {
                                  setRejectModal(reqItem);
                                  setRejectionReason('');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] transition-all flex items-center space-x-1 border border-rose-500/20 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400 space-y-2">
                    <ShieldCheck className="w-8 h-8 mx-auto opacity-30 text-neutral-400" />
                    <p className="text-sm font-semibold">No data found</p>
                    <p className="text-xs text-neutral-400">
                      No faculty authorization requests match your current filters for Academic Year {academicYear || 'selected'}.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── APPROVE CONFIRMATION MODAL ── */}
      {approveModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                Ratify & Activate Faculty
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                You are approving the appointment and curriculum authorization for:
              </p>
              <p className="text-sm font-black text-orange-600 dark:text-orange-400 pt-1">
                {approveModal.facultyName || 'Faculty Candidate'} ({approveModal.departmentCode || 'N/A'})
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/60 text-xs space-y-1.5 text-neutral-600 dark:text-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-400 font-medium">Designation:</span>
                <span className="font-bold">{approveModal.designation || 'Faculty'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 font-medium">Assigned Subject:</span>
                <span className="font-bold">{approveModal.subjectName || 'General Assignment'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 font-medium">Academic Year:</span>
                <span className="font-bold">{approveModal.academicYear || academicYear || '2026-27'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              Upon approval, the candidate's account will immediately transition to <strong>ACTIVE</strong> status and teaching assignments will be enabled.
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setApproveModal(null)}
                disabled={actionProcessing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveConfirm}
                disabled={actionProcessing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {actionProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Approval</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── REJECT CONFIRMATION MODAL ── */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                Reject Faculty Request
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                You are rejecting the registration for <strong>{rejectModal.facultyName || 'Faculty Candidate'}</strong>. Please provide a formal reason for the HOD.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Specify the reason (e.g. Credential mismatch, workload surplus, incorrect designation)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModal(null);
                  setRejectionReason('');
                }}
                disabled={actionProcessing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionProcessing || !rejectionReason.trim()}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {actionProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Rejection</span>
                  </>
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

export default PrincipalFacultyAuthorizationPage;
