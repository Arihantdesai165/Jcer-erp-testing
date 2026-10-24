import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building2,
  BookOpen,
  Calendar,
  AlertCircle,
  FileCheck2,
  RefreshCw,
  Mail,
  Phone,
  Layers,
} from 'lucide-react';
import principalService, { FacultyAuthDetailResponse } from '../../services/principal.service';
import Skeleton from '../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';

export const PrincipalFacultyReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [request, setRequest] = useState<FacultyAuthDetailResponse | null>(null);

  // Action Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequest = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await principalService.getFacultyAuthorizationById(id);
      setRequest(data);
    } catch (err) {
      toast.error('Failed to load faculty authorization request');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      const res = await principalService.approveFacultyAuthorization(id);
      toast.success(res?.message || 'Faculty approved successfully. Faculty account is now active.');
      setShowApproveModal(false);
      window.dispatchEvent(new CustomEvent('faculty-auth-changed'));
      fetchRequest();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    if (!rejectionReason.trim()) {
      toast.error('Please specify a rejection reason');
      return;
    }

    try {
      setProcessing(true);
      const res = await principalService.rejectFacultyAuthorization(id, rejectionReason.trim());
      toast.success(res?.message || 'Faculty authorization request rejected.');
      setShowRejectModal(false);
      window.dispatchEvent(new CustomEvent('faculty-auth-changed'));
      fetchRequest();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to reject request');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-12 text-center text-neutral-400 space-y-4 max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto text-amber-500 opacity-60" />
        <p className="text-sm font-semibold">Faculty authorization request not found.</p>
        <button
          onClick={() => navigate('/principal/faculty/authorizations')}
          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-all shadow-xs"
        >
          Back to Faculty Authorizations
        </button>
      </div>
    );
  }

  const { faculty, department, subject, createdByHOD, decidedBy } = request;

  const assignmentsList: any[] =
    request.assignments && request.assignments.length > 0
      ? request.assignments
      : Array.isArray(request.assignmentsData) && request.assignmentsData.length > 0
      ? request.assignmentsData
      : [
          {
            id: 'primary-assignment',
            subjectName: subject?.name || request.subjectName || 'General Assignment',
            subjectCode: subject?.code || request.subjectCode || 'N/A',
            semester: request.semester,
            section: request.section,
            attendanceAccess: true,
            marksAccess: true,
            status: 'INACTIVE',
          },
        ];

  const isPrincipalActionable = request.status === 'PENDING' && request.authority === 'PRINCIPAL';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── TOP NAVIGATION BAR ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/principal/faculty/authorizations')}
          className="px-3.5 py-2 rounded-xl bg-white/80 dark:bg-neutral-900/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-800/80 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-all flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Authorizations</span>
        </button>

        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center space-x-1.5 ${
              request.status === 'PENDING'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                : request.status === 'APPROVED'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {request.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
            {request.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {request.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
            <span>{request.status}</span>
          </span>

          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            Routing: {request.authority === 'PRINCIPAL' ? 'Principal Office' : 'Dean Academics'}
          </span>
        </div>
      </div>

      {/* ── MAIN REVIEW CARD ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        
        {/* Header Profile Section */}
        <div className="p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <ProfileAvatar
              imageUrl={faculty?.profileImage || request.profileImage}
              name={request.facultyName}
              size="xl"
              roundedClassName="rounded-2xl"
              className="w-16 h-16 border border-orange-200/50 dark:border-orange-800/40 shadow-sm shrink-0"
            />
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-black text-neutral-900 dark:text-white">
                  {request.facultyName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {department?.code || request.departmentCode}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{faculty?.email || request.email}</span>
                </span>
                {(faculty?.phone || request.phone) && (
                  <span className="flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{faculty?.phone || request.phone}</span>
                  </span>
                )}
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  • {request.designation || 'Assistant Professor'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons for Principal */}
          {isPrincipalActionable && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(true);
                  setRejectionReason('');
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-bold text-xs transition-all flex items-center space-x-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ratify & Approve</span>
              </button>
            </div>
          )}
        </div>

        {/* Breakdown Grid */}
        <div className="p-6 md:p-8 space-y-8">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center space-x-2 text-neutral-400 mb-1">
                <Building2 className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Department</span>
              </div>
              <p className="text-sm font-extrabold text-neutral-900 dark:text-white">
                {department?.name || request.departmentName}
              </p>
              <p className="text-xs text-neutral-400">Branch Code: {department?.code || request.departmentCode}</p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center space-x-2 text-neutral-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Academic Session</span>
              </div>
              <p className="text-sm font-extrabold text-neutral-900 dark:text-white">
                {request.academicYear}
              </p>
              <p className="text-xs text-neutral-400">Designation: {request.designation}</p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center space-x-2 text-neutral-400 mb-1">
                <User className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Submitting HOD</span>
              </div>
              <p className="text-sm font-extrabold text-neutral-900 dark:text-white">
                {createdByHOD
                  ? `${createdByHOD.firstName} ${createdByHOD.lastName}`
                  : request.createdBy || 'HOD'}
              </p>
              <p className="text-xs text-neutral-400">
                Submitted on: {new Date(request.createdDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Rejection notice if present */}
          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-xs space-y-1">
              <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300 font-bold">
                <XCircle className="w-4 h-4" />
                <span>Rejection Reason:</span>
              </div>
              <p className="text-rose-800 dark:text-rose-200 pl-6">{request.rejectionReason}</p>
              {request.decidedBy && (
                <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70 pl-6">
                  Decided by: {typeof decidedBy === 'string' ? decidedBy : `${decidedBy?.firstName || ''} ${decidedBy?.lastName || ''}`} on {new Date(request.decidedAt || '').toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Approval notice if present */}
          {request.status === 'APPROVED' && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1">
              <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Authorization Completed</span>
              </div>
              <p className="text-emerald-800 dark:text-emerald-200 pl-6">
                This faculty registration has been ratified and approved. Faculty user account and teaching assignments are active.
              </p>
              {request.decidedBy && (
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 pl-6">
                  Decided by: {typeof decidedBy === 'string' ? decidedBy : `${decidedBy?.firstName || ''} ${decidedBy?.lastName || ''}`} on {new Date(request.decidedAt || '').toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Teaching Assignments Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span>Curriculum Assignments & Course Allocations</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Teaching assignments designated to this faculty candidate by the department HOD.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                {assignmentsList.length} {assignmentsList.length === 1 ? 'Course' : 'Courses'}
              </span>
            </div>

            <div className="border border-neutral-100 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#111111] dark:bg-neutral-950 text-white font-extrabold uppercase text-[11px] tracking-wider border-b border-neutral-800">
                    <th className="py-3.5 px-6 font-semibold">Subject / Module</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Semester</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Course Type</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Credits</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Module Access Permissions</th>
                    <th className="py-3.5 px-6 font-semibold text-center">Assignment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {assignmentsList.map((assignment, idx) => (
                    <tr key={assignment.id || idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                      <td className="py-4 px-6">
                        <span className="font-extrabold text-neutral-900 dark:text-white block">
                          {assignment.subjectName}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-semibold">
                          Code: {assignment.subjectCode}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-neutral-800 dark:text-neutral-200">
                        <span>Sem {assignment.semester}</span>
                        {assignment.section && (
                          <span className="text-[10px] text-neutral-400 font-normal block">
                            Section {assignment.section}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
                          {assignment.subjectType || 'Theory'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-neutral-700 dark:text-neutral-300">
                        {assignment.credits || 4}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center space-x-1.5 text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              assignment.attendanceAccess
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50'
                                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
                            }`}
                          >
                            Attendance
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              assignment.marksAccess
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50'
                                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
                            }`}
                          >
                            Marks
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            request.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                          }`}
                        >
                          {request.status === 'APPROVED' ? 'ACTIVE' : 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── APPROVE MODAL ── */}
      {showApproveModal && createPortal(
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
                Confirm executive authorization for <strong>{request.facultyName}</strong>.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              Upon approval, the candidate's account will immediately transition to <strong>ACTIVE</strong> status and all {assignmentsList.length} curriculum teaching assignments will be activated.
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs flex items-center justify-center space-x-1.5"
              >
                {processing ? (
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

      {/* ── REJECT MODAL ── */}
      {showRejectModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                Reject Faculty Authorization
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Specify the institutional reason for declining this request.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Reason for rejection (e.g. Ineligible credentials, staffing ceiling exceeded)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all shadow-xs flex items-center justify-center space-x-1.5"
              >
                {processing ? (
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

export default PrincipalFacultyReviewPage;
