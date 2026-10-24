import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import admissionService, { AdmissionApplication } from '../../../services/admission.service';
import { 
  ArrowLeft, CheckCircle2, XCircle, Download, ZoomIn, ZoomOut, RotateCw, 
  FileText, ShieldCheck, AlertCircle, Loader2, Send, CheckSquare, Square, Building
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

export const FeeReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<AdmissionApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Zoom / Image rotation state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Verification Checklist State
  const [checklist, setChecklist] = useState({
    receiptIsClear: false,
    officialReceiptUploaded: false,
    fee500Paid: false,
  });

  // Internal Notes
  const [internalNotes, setInternalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    admissionService.getApplication(id)
      .then((data) => {
        setApp(data);
        if (data.feeVerificationRemarks) setInternalNotes(data.feeVerificationRemarks);
      })
      .catch((err) => {
        console.error('Failed to load application for fee review:', err);
        toast.error('Failed to load application details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <Loader2 className="w-10 h-10 text-violet-600 animate-spin mx-auto" />
        <p className="text-xs font-bold text-neutral-500">Loading fee review workspace...</p>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-neutral-800">Application Not Found</h2>
        <Link to="/admin/admissions/fees" className="text-xs font-bold text-violet-600 hover:underline">
          Back to Admission Fees Queue
        </Link>
      </div>
    );
  }

  const pd = app.studentpersonaldetails;
  const studentName = pd
    ? `${pd.firstName} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName}`.replace(/\s+/g, ' ').trim()
    : app.user
      ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim()
      : 'N/A';

  const receiptUrl = app.admissionFeeReceiptUrl || app.studentdocuments?.admissionFeeReceiptUrl;
  const approvedDate = app.reviewedAt || app.updatedAt;
  const allChecklistItemsChecked = checklist.receiptIsClear && checklist.officialReceiptUploaded && checklist.fee500Paid;

  const handleApprove = async () => {
    if (!allChecklistItemsChecked) {
      toast.error('Please verify all checklist items before approving.');
      return;
    }
    setSubmitting(true);
    try {
      await admissionService.verifyFeeReceipt(app.id, {
        approve: true,
        remarks: internalNotes,
      });
      toast.success('Fee receipt verified and application forwarded to Principal!');
      navigate('/admin/admissions/fees');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to verify fee receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejecting the fee receipt.');
      return;
    }
    setSubmitting(true);
    try {
      await admissionService.verifyFeeReceipt(app.id, {
        approve: false,
        remarks: internalNotes,
        rejectionReason,
      });
      toast.warn('Fee receipt rejected. Student has been asked to re-upload.');
      setShowRejectModal(false);
      navigate('/admin/admissions/fees');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to reject fee receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/admin/admissions/fees"
          className="inline-flex items-center text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Back to Admission Fees Queue</span>
        </Link>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-neutral-400">Admission Number:</span>
          <span className="text-xs font-black text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200">
            {app.applicationNumber}
          </span>
        </div>
      </div>

      {/* Main Grid: Left = Preview, Right = Student Details & Review Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT COLUMN: RECEIPT PREVIEW (7 cols) ── */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-neutral-200/70 shadow-sm flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-violet-600" />
              <h2 className="text-base font-extrabold text-neutral-900">Receipt Preview Section</h2>
            </div>
            {receiptUrl && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.2, 0.6))}
                  className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-neutral-500 w-12 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.2, 2.5))}
                  className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-lg text-xs flex items-center space-x-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            )}
          </div>

          {/* Large Preview Box */}
          <div className="flex-1 min-h-[480px] bg-neutral-900/5 rounded-2xl border border-neutral-200/80 overflow-auto flex items-center justify-center p-4 relative group">
            {receiptUrl ? (
              receiptUrl.endsWith('.pdf') ? (
                <iframe
                  src={receiptUrl}
                  className="w-full h-[520px] rounded-xl border-none"
                  title="Fee Receipt PDF Preview"
                />
              ) : (
                <img
                  src={receiptUrl}
                  alt="Official College Fee Receipt"
                  className="max-w-full max-h-[520px] object-contain rounded-xl transition-all duration-200 shadow-md"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  }}
                />
              )
            ) : (
              <div className="text-center py-20 space-y-3">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                <p className="text-sm font-bold text-neutral-700">No Admission Fee Receipt Uploaded Yet.</p>
                <p className="text-[11px] text-neutral-400 font-medium">Student has not uploaded the ₹500 Admission Processing Fee receipt yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: STUDENT DETAILS & REVIEW FORM (5 cols) ── */}
        <div className="lg:col-span-5 space-y-6">

          {/* Student Details Card */}
          <div className="bg-white rounded-3xl p-6 border border-neutral-200/70 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center space-x-2">
              <Building className="w-4 h-4 text-violet-600" />
              <span>Student Details</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-400 font-semibold">Application ID</span>
                <span className="font-extrabold text-neutral-900 font-mono">{app.applicationNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-400 font-semibold">Student Name</span>
                <span className="font-extrabold text-neutral-900">{studentName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-400 font-semibold">Department</span>
                <span className="font-bold text-neutral-800">{app.branch?.name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-400 font-semibold">Branch Code</span>
                <span className="font-bold text-neutral-800">{app.branch?.code || '—'} ({app.admissionType})</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400 font-semibold">Application Approved Date</span>
                <span className="font-bold text-neutral-800">
                  {approvedDate ? format(new Date(approvedDate), 'dd MMM yyyy, hh:mm a') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Checklist Card */}
          <div className="bg-white rounded-3xl p-6 border border-neutral-200/70 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-neutral-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-extrabold text-neutral-900">Verification Checklist</h2>
            </div>

            <div className="space-y-3">
              <label className="flex items-start space-x-3 p-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 transition-colors cursor-pointer border border-neutral-200/60">
                <input
                  type="checkbox"
                  checked={checklist.receiptIsClear}
                  onChange={(e) => setChecklist({ ...checklist, receiptIsClear: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-violet-600 rounded focus:ring-violet-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-neutral-800 select-none">
                  ☐ Uploaded receipt image / PDF is clear & readable
                </span>
              </label>

              <label className="flex items-start space-x-3 p-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 transition-colors cursor-pointer border border-neutral-200/60">
                <input
                  type="checkbox"
                  checked={checklist.officialReceiptUploaded}
                  onChange={(e) => setChecklist({ ...checklist, officialReceiptUploaded: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-violet-600 rounded focus:ring-violet-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-neutral-800 select-none">
                  ☐ Official college receipt is uploaded
                </span>
              </label>

              <label className="flex items-start space-x-3 p-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 transition-colors cursor-pointer border border-neutral-200/60">
                <input
                  type="checkbox"
                  checked={checklist.fee500Paid}
                  onChange={(e) => setChecklist({ ...checklist, fee500Paid: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-violet-600 rounded focus:ring-violet-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-neutral-800 select-none">
                  ☐ ₹500 Admission Processing Fee has been paid
                </span>
              </label>
            </div>
          </div>

          {/* Internal Notes Card */}
          <div className="bg-white rounded-3xl p-6 border border-neutral-200/70 shadow-sm space-y-3">
            <label className="block text-xs font-extrabold text-neutral-700 uppercase tracking-wider">
              Internal Notes (Optional)
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              placeholder="Add any internal verification remarks here..."
              className="w-full text-xs font-semibold p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:border-violet-500 focus:bg-white resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              disabled={submitting}
              className="flex-1 py-3.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center space-x-2"
            >
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Reject Receipt</span>
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={submitting || !allChecklistItemsChecked}
              className="flex-1 py-3.5 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Approve & Forward to Principal</span>
            </button>
          </div>

        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-neutral-900">Reject Fee Receipt</h3>
              <p className="text-xs text-neutral-500">
                Please specify why the fee receipt was rejected. The student will be asked to re-upload a clear official receipt.
              </p>
            </div>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="e.g. Uploaded document is blurred / Not an official college receipt / Incorrect amount..."
              className="w-full text-xs font-semibold p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white resize-none"
            />

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={submitting}
                className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting || !rejectionReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Reject & Request Re-upload</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FeeReviewPage;
