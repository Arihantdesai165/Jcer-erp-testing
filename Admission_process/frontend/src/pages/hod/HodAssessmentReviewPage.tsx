import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import hodAssessmentService, {
  AssessmentReviewDetailData,
} from '../../services/hodAssessment.service';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Send,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  User,
  BookOpen,
  Search,
  Filter,
  Check,
  X,
  Clock,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const HodAssessmentReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [reviewDetail, setReviewDetail] = useState<AssessmentReviewDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Student list search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'BELOW_20'>('ALL');

  // Action Modals State
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [returning, setReturning] = useState(false);

  const loadData = async (isManual = false) => {
    if (!id) return;
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const detail = await hodAssessmentService.getReviewDetail(id);
      setReviewDetail(detail);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to load assessment review details.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Submit Approval & Publication
  const handleConfirmApprove = async () => {
    if (!id) return;
    setApproving(true);
    try {
      const res = await hodAssessmentService.approveAndPublish(id, { publishNow: true });
      toast.success(res.message || 'Assessment approved and published to students!');
      setShowApproveModal(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to approve assessment.');
    } finally {
      setApproving(false);
    }
  };

  // Submit Return for Correction
  const handleConfirmReturn = async () => {
    if (!id) return;
    if (!returnComment.trim()) {
      toast.error('Please enter revision comments explaining what needs correction.');
      return;
    }
    setReturning(true);
    try {
      const res = await hodAssessmentService.returnForCorrection(id, returnComment.trim());
      toast.success(res.message || 'Assessment returned to faculty for correction.');
      setShowReturnModal(false);
      setReturnComment('');
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to return assessment.');
    } finally {
      setReturning(false);
    }
  };

  const getStatusBadge = (status: string, isPublished: boolean) => {
    if (isPublished) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>PUBLISHED</span>
        </span>
      );
    }
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
            <Clock className="w-3.5 h-3.5" />
            <span>DRAFT</span>
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 animate-pulse">
            <Send className="w-3.5 h-3.5" />
            <span>SUBMITTED FOR REVIEW</span>
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RETURNED FOR CORRECTION</span>
          </span>
        );
      case 'RESUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RESUBMITTED</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>APPROVED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            {status}
          </span>
        );
    }
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    if (!reviewDetail?.students) return [];
    let list = reviewDetail.students;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (st) =>
          st.studentName.toLowerCase().includes(q) ||
          st.usn.toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'ELIGIBLE') {
      list = list.filter((st) => st.finalCieMarks >= 20);
    } else if (statusFilter === 'BELOW_20') {
      list = list.filter((st) => st.finalCieMarks < 20);
    }

    return list;
  }, [reviewDetail, searchQuery, statusFilter]);

  // Statistics
  const studentStats = useMemo(() => {
    if (!reviewDetail?.students) return { total: 0, eligible: 0, below20: 0, avg: 0 };
    const total = reviewDetail.students.length;
    const eligible = reviewDetail.students.filter((st) => st.finalCieMarks >= 20).length;
    const below20 = total - eligible;
    const sum = reviewDetail.students.reduce((acc, st) => acc + (st.finalCieMarks || 0), 0);
    const avg = total > 0 ? (sum / total).toFixed(1) : 0;
    return { total, eligible, below20, avg };
  }, [reviewDetail]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="size-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin mx-auto" />
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
          Loading assessment review details...
        </p>
      </div>
    );
  }

  if (error || !reviewDetail) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            to="/hod/assessments"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 border-2 border-slate-800 dark:border-neutral-700 rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assessments</span>
          </Link>
        </div>
        <div className="p-8 text-center rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
            {error || 'Assessment not found or unauthorized.'}
          </p>
          <button
            onClick={() => loadData(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const { assessment } = reviewDetail;
  const canReview = ['SUBMITTED', 'RESUBMITTED'].includes(assessment.status);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header & Breadcrumb ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/hod/assessments"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 border-2 border-slate-800 dark:border-neutral-700 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assessments</span>
          </Link>
          <span className="text-neutral-400 dark:text-neutral-600">/</span>
          <span className="text-xs font-black text-neutral-500 uppercase tracking-wider">
            Review Submission
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {canReview && (
            <>
              <button
                onClick={() => setShowReturnModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-extrabold text-xs transition-all shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return for Correction</span>
              </button>

              <button
                onClick={() => setShowApproveModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-500/25 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve & Publish</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Assessment Identity Hero Card ───────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-white/60 dark:border-neutral-800 shadow-sm bg-white/90 dark:bg-neutral-900/90">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-xl shadow-md ring-4 ring-white dark:ring-neutral-800 flex-shrink-0">
              {assessment.assessmentType === 'CIE1' ? 'C1' : 'C2'}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-neutral-900 dark:text-white">
                  {assessment.subjectCode} — {assessment.subjectName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {assessment.assessmentType === 'CIE1' ? 'CIE-1' : assessment.assessmentType === 'CIE2' ? 'CIE-2' : assessment.assessmentType}
                </span>
                {getStatusBadge(assessment.status, assessment.isPublished)}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-neutral-400" />
                  Semester {assessment.semester}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  AY {assessment.academicYear}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                  {assessment.departmentName} ({assessment.departmentCode})
                </span>
                <span className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-neutral-400" />
                  Maximum Marks: {assessment.maximumMarks}
                </span>
              </p>
            </div>
          </div>

          {/* Submission Info / Attempt pill */}
          <div className="flex flex-wrap lg:flex-col lg:items-end justify-between gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>Submitted by: <strong className="text-neutral-900 dark:text-white">{assessment.submittedBy || 'Assigned Faculty'}</strong></span>
            </div>
            {assessment.submittedAt && (
              <div className="text-[11px] text-neutral-400">
                Submitted on {new Date(assessment.submittedAt).toLocaleString()}
                {assessment.submissionCount > 1 ? ` • Attempt #${assessment.submissionCount}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Quick KPI Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-neutral-200/60 dark:border-neutral-800">
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Total Enrolled</span>
            <div className="text-xl font-black text-neutral-900 dark:text-white mt-0.5">
              {studentStats.total} <span className="text-xs font-bold text-neutral-400">Students</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Passing (≥20 Marks)</span>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
              {studentStats.eligible} <span className="text-xs font-bold text-emerald-600/70">({studentStats.total > 0 ? Math.round((studentStats.eligible / studentStats.total) * 100) : 0}%)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">Below 20 Marks</span>
            <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5">
              {studentStats.below20} <span className="text-xs font-bold text-rose-600/70">({studentStats.total > 0 ? Math.round((studentStats.below20 / studentStats.total) * 100) : 0}%)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Cohort Average</span>
            <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
              {studentStats.avg} <span className="text-xs font-bold text-indigo-500">/ {assessment.maximumMarks}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Notice Banners ─────────────────────────────────────────── */}
      {assessment.status === 'RETURNED' && assessment.hodReviewComment && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3.5 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider">
              Assessment Returned for Faculty Correction
            </h4>
            <p className="text-xs text-rose-800 dark:text-rose-300 font-medium">
              "{assessment.hodReviewComment}"
            </p>
            {assessment.reviewedAt && (
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                Action recorded on {new Date(assessment.reviewedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {assessment.isPublished && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3.5 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
              Official Assessment Results Published
            </h4>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              These CIE scores are verified, approved, and live on the student dashboards.
            </p>
            {assessment.publishedAt && (
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                Published on {new Date(assessment.publishedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {canReview && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
              This assessment submission is pending your review. Verify each student's score below and either Return for Correction or Approve & Publish.
            </p>
          </div>
        </div>
      )}

      {/* ── Student Marks Entry Verification Table ───────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        {/* Table Filter Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-850">
          <div>
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>Student Marks Entry Verification</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                {filteredStudents.length} of {reviewDetail.students.length}
              </span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Passing threshold: 40% (20 / {assessment.maximumMarks} Marks)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search USN or student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Students</option>
              <option value="ELIGIBLE">Eligible (≥20 Marks)</option>
              <option value="BELOW_20">Below 20 Marks</option>
            </select>
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100/70 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="py-3 px-4 text-center w-14">SL.</th>
                <th className="py-3 px-4 w-44">USN</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4 text-center w-36">Marks Obtained</th>
                <th className="py-3 px-4 text-center w-28">Max Marks</th>
                <th className="py-3 px-4 text-center w-28">Percentage</th>
                <th className="py-3 px-4 text-center w-36">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400 italic">
                    No students match the selected search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.studentId} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-neutral-500">{st.slNo}</td>
                    <td className="py-3 px-4 font-extrabold text-neutral-900 dark:text-white uppercase tracking-wider">
                      {st.usn}
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-800 dark:text-neutral-200 uppercase">
                      {st.studentName}
                    </td>
                    <td className="py-3 px-4 text-center font-black text-sm text-indigo-700 dark:text-indigo-300">
                      {st.finalCieMarks}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-neutral-500">
                      {assessment.maximumMarks}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-neutral-700 dark:text-neutral-300">
                      {st.percentage}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      {st.finalCieMarks >= 20 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          Eligible (≥20)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          Below 20
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Workflow & Audit History Timeline ─────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
        <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Assessment Review & Workflow History</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {reviewDetail.reviewHistory.length} Events
          </span>
        </h3>

        {reviewDetail.reviewHistory.length === 0 ? (
          <p className="text-xs text-neutral-400 italic py-4">No historical audit events recorded yet.</p>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
            {reviewDetail.reviewHistory.map((h) => (
              <div key={h.id} className="relative flex items-start gap-4 pl-8">
                <div className="absolute left-1.5 top-2 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-neutral-900 ring-2 ring-indigo-200 dark:ring-indigo-900" />
                <div className="flex-1 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="font-extrabold text-neutral-900 dark:text-white">
                      {h.action} by <span className="text-indigo-600 dark:text-indigo-400">{h.actorName || h.actorRole}</span>
                    </span>
                    <span className="text-[11px] text-neutral-400 font-medium">
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {h.comments && (
                    <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800 font-medium">
                      "{h.comments}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── APPROVE & PUBLISH CONFIRMATION MODAL ─────────────────────────── */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                Approve & Publish CIE Marks?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                You are about to officially approve and publish marks for{' '}
                <strong className="text-neutral-800 dark:text-neutral-200">
                  {assessment.subjectCode} — {assessment.assessmentType}
                </strong>
                . Once published, all {reviewDetail.students.length} students will immediately see these results on their Student Marks Portal.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 text-xs space-y-1.5 border border-neutral-200 dark:border-neutral-700">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span>Subject:</span>
                <span className="font-extrabold text-neutral-900 dark:text-white">{assessment.subjectName}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span>Semester & AY:</span>
                <span className="font-extrabold text-neutral-900 dark:text-white">Sem {assessment.semester} • AY {assessment.academicYear}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                <span>Total Students:</span>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{reviewDetail.students.length} Students</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                disabled={approving}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 font-bold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={approving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-500/25 disabled:opacity-50"
              >
                {approving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Publish Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RETURN FOR CORRECTION MODAL ───────────────────────────────────── */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                Return Assessment for Correction
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Please provide specific revision comments for faculty ({assessment.submittedBy || 'Faculty'}).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Revision / Correction Instructions <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="E.g., Please re-verify student marks for question 2; total marks exceeded the ceiling..."
                className="w-full p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                disabled={returning}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 font-bold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={returning}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-all shadow-md shadow-rose-500/25 disabled:opacity-50"
              >
                {returning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Returning...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Send for Correction</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodAssessmentReviewPage;
