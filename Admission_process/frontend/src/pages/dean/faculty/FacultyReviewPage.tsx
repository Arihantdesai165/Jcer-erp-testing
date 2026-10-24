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
} from 'lucide-react';
import deanService from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const FacultyReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [request, setRequest] = useState<any>(null);

  // Action Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequest = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await deanService.getFacultyAuthorizationById(id);
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
      await deanService.approveFacultyAuthorization(id);
      toast.success('Faculty approved successfully. Faculty account is now active.');
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
      await deanService.rejectFacultyAuthorization(id, rejectionReason.trim());
      toast.success('Faculty authorization request rejected.');
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
      <div className="p-12 text-center text-neutral-400 space-y-4">
        <p className="text-sm font-semibold">Faculty authorization request not found.</p>
        <button
          onClick={() => navigate('/dean/faculty/authorizations')}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs"
        >
          Back to Authorizations
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
            id: 'legacy-assignment',
            subjectName: subject?.name || 'General Assignment',
            subjectCode: subject?.code || 'N/A',
            semester: request.semester,
            section: request.section,
            academicYear: request.academicYear,
            attendanceAccess: true,
            marksAccess: true,
          },
        ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── BACK BUTTON ── */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => navigate('/dean/faculty/authorizations')}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Authorizations Queue</span>
        </button>
      </div>

      {/* ── HEADER BANNER ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <ProfileAvatar
            imageUrl={faculty?.profileImage}
            name={`${faculty?.firstName || ''} ${faculty?.lastName || ''}`.trim() || 'Faculty'}
            size="xl"
            roundedClassName="rounded-2xl"
            className="w-16 h-16 shadow-md shrink-0"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                {faculty?.firstName} {faculty?.lastName}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  request.status === 'PENDING'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : request.status === 'APPROVED'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}
              >
                {request.status} AUTHORIZATION
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Department: <span className="font-bold text-neutral-800 dark:text-neutral-200">{department?.name} ({department?.code})</span>
            </p>
            <p className="text-xs text-neutral-400">Designation: {request.designation || 'Assistant Professor'}</p>
          </div>
        </div>

        {/* Action Buttons if Pending */}
        {request.status === 'PENDING' ? (
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => {
                setShowRejectModal(true);
                setRejectionReason('');
              }}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all border border-rose-500/20 flex items-center space-x-1"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject Request</span>
            </button>
            <button
              onClick={() => setShowApproveModal(true)}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Faculty</span>
            </button>
          </div>
        ) : (
          <div className="text-right">
            <span className="text-xs text-neutral-400 block">Decided On</span>
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
              {request.decidedAt ? new Date(request.decidedAt).toLocaleString() : 'N/A'}
            </span>
            {decidedBy && (
              <span className="text-[10px] text-neutral-400">By {decidedBy.firstName} {decidedBy.lastName}</span>
            )}
          </div>
        )}
      </div>

      {/* ── REJECTION REASON CALLOUT IF REJECTED ── */}
      {request.status === 'REJECTED' && request.rejectionReason && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-300 text-xs space-y-1">
          <span className="font-extrabold uppercase text-[10px] tracking-wider block text-rose-700 dark:text-rose-400">
            Rejection Remarks
          </span>
          <p className="font-medium">{request.rejectionReason}</p>
        </div>
      )}

      {/* ── TWO COLUMN DETAILS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Column 1: Faculty Profile & Account */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <User className="w-4 h-4 text-amber-600" />
            <span>Faculty Candidate Details</span>
          </h3>

          <div className="space-y-3 text-xs divide-y divide-neutral-100 dark:divide-neutral-800">
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Full Name</span>
              <span className="font-bold text-neutral-900 dark:text-white">{faculty?.firstName} {faculty?.lastName}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Official Email</span>
              <span className="font-bold text-neutral-900 dark:text-white">{faculty?.email}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Phone</span>
              <span className="font-bold text-neutral-900 dark:text-white">{faculty?.phone || 'Not provided'}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Proposed Designation</span>
              <span className="font-bold text-neutral-800 dark:text-neutral-200">{request.designation || 'Assistant Professor'}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Account Status</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{faculty?.status || 'PENDING'}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Department & Academic Workflow Scope */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Academic Department Scope</span>
          </h3>

          <div className="space-y-3 text-xs divide-y divide-neutral-100 dark:divide-neutral-800">
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Department</span>
              <span className="font-bold text-neutral-900 dark:text-white">{department?.name} ({department?.code})</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Teaching Assignments</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{assignmentsList.length} Subject(s) Assigned</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Target Academic Year</span>
              <span className="font-bold text-neutral-900 dark:text-white">{request.academicYear}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Requested By</span>
              <span className="font-bold text-neutral-800 dark:text-neutral-200">{createdByHOD ? `${createdByHOD.firstName} ${createdByHOD.lastName}` : 'Department HOD'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── TEACHING ASSIGNMENTS & PER-SUBJECT PERMISSIONS ── */}
      <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Teaching Assignments & Per-Subject Permissions
            </h3>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
            {assignmentsList.length} {assignmentsList.length === 1 ? 'Assignment' : 'Assignments'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {assignmentsList.map((a: any, idx: number) => {
            const attEnabled = a.attendanceAccess !== false && a.permissions?.attendance !== false;
            const marksEnabled = a.marksAccess !== false && a.permissions?.marks !== false;

            return (
              <div
                key={a.id || idx}
                className="p-4 sm:p-5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-extrabold">
                      Semester {a.semester}
                    </span>
                    <span className="text-sm font-extrabold text-neutral-900 dark:text-white">
                      {a.subjectName}
                    </span>
                    <span className="text-xs font-mono font-bold text-neutral-500 bg-neutral-200/60 dark:bg-neutral-700/60 px-2 py-0.5 rounded">
                      {a.subjectCode}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 font-semibold flex items-center gap-3">
                    <span>AY: {a.academicYear || request.academicYear}</span>
                  </div>
                </div>

                {/* Permissions Badges */}
                <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 flex flex-wrap gap-2.5 text-xs">
                  {/* Attendance */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-[11px] ${
                    attEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                  }`}>
                    {attEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-neutral-400" />}
                    <span>Attendance Access: {attEnabled ? 'Enabled' : 'Disabled'}</span>
                  </div>

                  {/* Marks */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-[11px] ${
                    marksEnabled
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                  }`}>
                    {marksEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> : <XCircle className="w-3.5 h-3.5 text-neutral-400" />}
                    <span>Marks & Bit-Wise Access: {marksEnabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── TIMELINE ── */}
      <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Authorization Audit Timeline</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 text-xs">
          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 space-y-1">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">1. Created</span>
            <p className="font-bold text-neutral-900 dark:text-white">Profile Registered</p>
            <p className="text-[10px] text-neutral-400">By {createdByHOD ? `${createdByHOD.firstName} ${createdByHOD.lastName}` : 'HOD'}</p>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 space-y-1">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">2. Teaching Scope</span>
            <p className="font-bold text-neutral-900 dark:text-white">{assignmentsList.length} Subject(s)</p>
            <p className="text-[10px] text-neutral-400">Across Assigned Semesters</p>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 space-y-1">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">3. Routed Authority</span>
            <p className="font-bold text-amber-700 dark:text-amber-300">Dean Academics</p>
            <p className="text-[10px] text-neutral-400">{new Date(request.createdAt).toLocaleDateString()}</p>
          </div>

          <div className={`p-3 rounded-2xl border space-y-1 ${
            request.status === 'APPROVED'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
              : request.status === 'REJECTED'
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30'
              : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30'
          }`}>
            <span className="text-[10px] font-bold text-neutral-400 uppercase">4. Decision Status</span>
            <p className={`font-bold ${
              request.status === 'APPROVED'
                ? 'text-emerald-700 dark:text-emerald-400'
                : request.status === 'REJECTED'
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}>
              {request.status}
            </p>
            <p className="text-[10px] text-neutral-400">
              {request.decidedAt ? new Date(request.decidedAt).toLocaleDateString() : 'Awaiting Review'}
            </p>
          </div>
        </div>
      </div>

      {/* ── APPROVE MODAL ── */}
      {showApproveModal && createPortal(
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
              <p><span className="text-neutral-400">Faculty:</span> <strong className="text-neutral-900 dark:text-white">{faculty?.firstName} {faculty?.lastName}</strong></p>
              <p><span className="text-neutral-400">Department:</span> <strong className="text-neutral-900 dark:text-white">{department?.name}</strong></p>
              <p><span className="text-neutral-400">Teaching Scope:</span> <strong className="text-neutral-900 dark:text-white">{assignmentsList.length} Teaching Assignment(s) will be activated</strong></p>
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              After approval, the faculty account will become active and the faculty will be able to log into the ERP.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleApprove}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {processing ? 'Approving...' : 'Approve Faculty'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── REJECT MODAL ── */}
      {showRejectModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <XCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                Reject Faculty Authorization
              </h3>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Candidate: <strong className="text-neutral-900 dark:text-white">{faculty?.firstName} {faculty?.lastName}</strong> ({department?.name})
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
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing || !rejectionReason.trim()}
                onClick={handleReject}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {processing ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default FacultyReviewPage;
