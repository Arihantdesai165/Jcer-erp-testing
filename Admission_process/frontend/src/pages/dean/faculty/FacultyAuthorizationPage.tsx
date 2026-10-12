import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, CheckCircle2, XCircle, Eye, AlertCircle, RefreshCw, SlidersHorizontal, Filter, RotateCcw, X } from 'lucide-react';
import deanService, { FacultyAuthRequest, DepartmentRecord, AcademicYearRecord } from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const FacultyAuthorizationPage: React.FC = () => {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<FacultyAuthRequest[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('PENDING');
  const [selectedYear, setSelectedYear] = useState<string>('2026-27');

  // Quick Action Modal State
  const [approveModal, setApproveModal] = useState<FacultyAuthRequest | null>(null);
  const [rejectModal, setRejectModal] = useState<FacultyAuthRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  const fetchDependencies = async () => {
    try {
      const [depts, yrs] = await Promise.all([
        deanService.getDepartments(),
        deanService.getAcademicYears(),
      ]);
      setDepartments(depts);
      setAcademicYears(yrs);
      const activeYr = yrs.find((y) => y.isCurrent)?.year || '2026-27';
      setSelectedYear(activeYr);
    } catch (err) {
      toast.error('Failed to load filter options');
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await deanService.getFacultyAuthorizations({
        search: search || undefined,
        departmentId: selectedDept,
        status: selectedStatus,
        academicYear: selectedYear,
      });
      setRequests(Array.isArray(data) ? data : []);
      window.dispatchEvent(new CustomEvent('faculty-auth-changed'));
    } catch (err) {
      console.warn('Could not load faculty authorization requests:', err);
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
  }, [selectedDept, selectedStatus, selectedYear]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRequests();
  };

  const handleApproveConfirm = async () => {
    if (!approveModal) return;
    try {
      setActionProcessing(true);
      await deanService.approveFacultyAuthorization(approveModal.id);
      toast.success('Faculty approved successfully. Faculty account is now active.');
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
      await deanService.rejectFacultyAuthorization(rejectModal.id, rejectionReason.trim());
      toast.success('Faculty authorization request rejected.');
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

  return (
    <div className="space-y-6">

      {/* ── TOP CONTROLS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by faculty name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none"
          >
            <option value="ALL">All Requests</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.year}>
                {y.year}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
          >
            Filter
          </button>
        </form>
      </div>

      {/* ── TABLE CARD ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <span>Faculty Authorization Requests Queue</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            HOD-initiated faculty registrations awaiting Dean Academics review, credential verification, and account activation.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-6 font-bold text-white text-left">Faculty Candidate</th>
                <th className="py-3.5 px-6 font-bold text-white">Department</th>
                <th className="py-3.5 px-6 font-bold text-white">Assigned Subject</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Class</th>
                <th className="py-3.5 px-6 font-bold text-white">Submitted By</th>
                <th className="py-3.5 px-6 font-bold text-white">Submitted On</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Status</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="py-4 px-6"><Skeleton className="w-32 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-28 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-16 h-4 mx-auto" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-24 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-20 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-16 h-4 mx-auto" /></td>
                    <td className="py-4 px-6 text-right"><Skeleton className="w-24 h-4 ml-auto" /></td>
                  </tr>
                ))
              ) : requests.length ? (
                requests.map((reqItem) => (
                  <tr key={reqItem.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-4 px-6 text-left">
                      <div>
                        <span className="font-extrabold text-neutral-900 dark:text-white block whitespace-nowrap">{reqItem.facultyName}</span>
                        <span className="text-[10px] text-neutral-400 block whitespace-nowrap">{reqItem.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-neutral-800 dark:text-neutral-200">
                      <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
                        {reqItem.departmentCode}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-bold text-neutral-900 dark:text-white block">{reqItem.subjectName}</span>
                      <span className="text-[10px] text-neutral-400">{reqItem.subjectCode}</span>
                    </td>
                    <td className="py-4 px-6 text-center font-semibold text-neutral-700 dark:text-neutral-300">
                      Sem {reqItem.semester}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400 font-medium">
                      {reqItem.createdBy}
                    </td>
                    <td className="py-4 px-6 text-neutral-500">
                      {new Date(reqItem.createdDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {(() => {
                        const isOverallAuthorized = reqItem.overallStatus === 'AUTHORIZED';
                        const isDeanApproved = reqItem.status === 'APPROVED';
                        const isPrincipalApproved = reqItem.principalApproval?.status === 'APPROVED';

                        if (isOverallAuthorized) {
                          if (isDeanApproved && isPrincipalApproved) {
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
                          if (isDeanApproved) {
                            return (
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  AUTHORIZED
                                </span>
                                <span className="text-[9px] text-neutral-500 font-medium mt-0.5">Dean Approved</span>
                              </div>
                            );
                          }
                          if (isPrincipalApproved) {
                            return (
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
                                  <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                  AUTHORIZED
                                </span>
                                <span className="text-[9px] text-purple-600 font-medium mt-0.5">By Principal</span>
                              </div>
                            );
                          }
                          return (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                              AUTHORIZED
                            </span>
                          );
                        }

                        if (reqItem.status === 'REJECTED') {
                          return (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                              REJECTED
                            </span>
                          );
                        }

                        return (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                            PENDING REVIEW
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => navigate(`/dean/faculty/authorizations/${reqItem.id}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-[11px] transition-all flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>

                        {reqItem.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => setApproveModal(reqItem)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] transition-all flex items-center space-x-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setRejectModal(reqItem);
                                setRejectionReason('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] transition-all flex items-center space-x-1"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-400">
                    No data found in this queue.
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
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                Approve Faculty Authorization
              </h3>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Are you sure you want to approve this faculty account?
            </p>

            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 space-y-1.5 text-xs">
              <p><span className="text-neutral-400">Faculty:</span> <strong className="text-neutral-900 dark:text-white">{approveModal.facultyName}</strong></p>
              <p><span className="text-neutral-400">Department:</span> <strong className="text-neutral-900 dark:text-white">{approveModal.departmentName}</strong></p>
              <p><span className="text-neutral-400">Subject:</span> <strong className="text-neutral-900 dark:text-white">{approveModal.subjectName} (Sem {approveModal.semester})</strong></p>
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              After approval, the faculty account will become active and the faculty will be able to log into the ERP.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setApproveModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProcessing}
                onClick={handleApproveConfirm}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {actionProcessing ? 'Approving...' : 'Approve Faculty'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── REJECT CONFIRMATION MODAL ── */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <XCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                Reject Faculty Authorization
              </h3>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Candidate: <strong className="text-neutral-900 dark:text-white">{rejectModal.facultyName}</strong> ({rejectModal.departmentName})
            </p>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Reason for rejection *
              </label>
              <textarea
                rows={3}
                placeholder="State the reason for rejecting this authorization request (visible to HOD)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                required
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProcessing || !rejectionReason.trim()}
                onClick={handleRejectConfirm}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {actionProcessing ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default FacultyAuthorizationPage;
