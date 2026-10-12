import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAcademicYear } from '../../context/AcademicYearContext';
import hodAssessmentService, {
  AssessmentOverviewStats,
  AssessmentSubmissionItem,
} from '../../services/hodAssessment.service';
import {
  Award,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Send,
  Eye,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  User,
  BookOpen,
  FileSpreadsheet,
  X,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const HodAssessmentManagementPage: React.FC = () => {
  const { academicYear } = useAcademicYear();

  const [stats, setStats] = useState<AssessmentOverviewStats | null>(null);
  const [submissions, setSubmissions] = useState<AssessmentSubmissionItem[]>([]);
  const [scope, setScope] = useState<{ departmentName: string; departmentCode: string; isSemesterHandling: boolean }>({
    departmentName: 'Loading Department...',
    departmentCode: '...',
    isSemesterHandling: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const [statsData, subData] = await Promise.all([
        hodAssessmentService.getOverviewStats(),
        hodAssessmentService.getSubmissions({ academicYear }),
      ]);

      setStats(statsData);
      setSubmissions(subData.submissions);
      setScope(subData.scope);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to load assessment data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [academicYear]);

  // Filter Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Semester filter
      if (selectedSemester !== 'ALL' && String(sub.semester) !== selectedSemester) {
        return false;
      }
      // Assessment Type filter
      if (selectedAssessmentType !== 'ALL' && sub.assessmentType !== selectedAssessmentType) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'REQUIRE_REVIEW' && !['SUBMITTED', 'RESUBMITTED'].includes(sub.status)) {
          return false;
        }
        if (selectedStatus !== 'REQUIRE_REVIEW' && sub.status !== selectedStatus) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject =
          sub.subjectCode.toLowerCase().includes(q) || sub.subjectName.toLowerCase().includes(q);
        const matchesFaculty =
          sub.allocatedFaculty?.name.toLowerCase().includes(q) ||
          sub.allocatedFaculty?.email.toLowerCase().includes(q);
        if (!matchesSubject && !matchesFaculty) {
          return false;
        }
      }
      return true;
    });
  }, [submissions, selectedSemester, selectedAssessmentType, selectedStatus, searchQuery]);

  // Allowed semester options depending on scope
  const availableSemesters = useMemo(() => {
    if (scope.isSemesterHandling) {
      return [1, 2];
    }
    return [3, 4, 5, 6, 7, 8];
  }, [scope.isSemesterHandling]);

  const getStatusBadge = (status: string, isPublished: boolean) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Published</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Approved</span>
          </span>
        );
      case 'RESUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800 animate-pulse">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Resubmitted</span>
          </span>
        );
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Pending Review</span>
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Returned</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
            <span>Draft</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
              <Award className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <span>Examination & Assessment Management</span>
            </h1>
            <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 text-xs font-extrabold border border-indigo-200 dark:border-indigo-800">
              {scope.isSemesterHandling ? 'Semesters 1 & 2 (First Year Scope)' : `${scope.departmentName} (${scope.departmentCode})`}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 text-xs font-bold border border-slate-200 dark:border-neutral-700">
              AY {academicYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Review Continuous Internal Evaluation (CIE) submissions, request corrections, and approve marks for student publication.
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* ── OVERVIEW STATISTICS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Requiring Review */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
            <span className="text-xs font-bold uppercase tracking-wider">Need Review</span>
            <Send className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-950 dark:text-indigo-100">
              {stats?.totalRequiringReview || 0}
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 font-medium mt-0.5">
              Pending + Resubmitted
            </p>
          </div>
        </div>

        {/* Card 2: Pending Reviews */}
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-bold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-950 dark:text-amber-100">
              {stats?.pendingReview || 0}
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 font-medium mt-0.5">
              Initial Submissions
            </p>
          </div>
        </div>

        {/* Card 3: Resubmitted */}
        <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-xs font-bold uppercase tracking-wider">Resubmitted</span>
            <RotateCcw className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-purple-950 dark:text-purple-100">
              {stats?.resubmitted || 0}
            </div>
            <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 font-medium mt-0.5">
              Corrected by Faculty
            </p>
          </div>
        </div>

        {/* Card 4: Returned for Correction */}
        <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-xs font-bold uppercase tracking-wider">Returned</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-950 dark:text-rose-100">
              {stats?.returned || 0}
            </div>
            <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 font-medium mt-0.5">
              Awaiting Resubmission
            </p>
          </div>
        </div>

        {/* Card 5: Approved */}
        <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-600 dark:text-teal-400">
            <span className="text-xs font-bold uppercase tracking-wider">Approved</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-teal-950 dark:text-teal-100">
              {stats?.approved || 0}
            </div>
            <p className="text-[11px] text-teal-700/80 dark:text-teal-300/80 font-medium mt-0.5">
              Verified by HOD
            </p>
          </div>
        </div>

        {/* Card 6: Published */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Published</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
              {stats?.published || 0}
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-medium mt-0.5">
              Live on Student Portal
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by subject code, subject name, or faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Semester Selector */}
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Semesters</option>
            {availableSemesters.map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>

          {/* Assessment Type Selector */}
          <select
            value={selectedAssessmentType}
            onChange={(e) => setSelectedAssessmentType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Assessments</option>
            <option value="CIE1">CIE-1</option>
            <option value="CIE2">CIE-2</option>
          </select>

          {/* Status Selector */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="REQUIRE_REVIEW">⚡ Needs Review (Pending & Resubmitted)</option>
            <option value="SUBMITTED">Pending Initial Review</option>
            <option value="RESUBMITTED">Resubmitted</option>
            <option value="RETURNED">Returned for Correction</option>
            <option value="APPROVED">Approved</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      </div>

      {/* ── SUBMISSIONS LIST TABLE ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-black text-neutral-900 dark:text-white tracking-tight">
              Assessment Submissions Roster
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[11px] font-extrabold text-neutral-600 dark:text-neutral-400">
              {filteredSubmissions.length} of {submissions.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-bold text-neutral-500">Loading authorized assessment submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              No Submissions Found
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              {submissions.length === 0
                ? 'No faculty members have submitted marks for your review yet.'
                : 'No submissions match the selected search or filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50/80 dark:bg-neutral-850 text-neutral-500 dark:text-neutral-400 font-extrabold uppercase tracking-wider text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="py-3 px-4">Assessment</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Allocated Faculty</th>
                  <th className="py-3 px-4 text-center">Semester</th>
                  <th className="py-3 px-4 text-center">Students</th>
                  <th className="py-3 px-4">Submission Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredSubmissions.map((sub) => {
                  const needsReview = ['SUBMITTED', 'RESUBMITTED'].includes(sub.status);
                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors ${
                        needsReview ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Assessment Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-black text-neutral-900 dark:text-white px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {sub.assessmentType === 'CIE1' ? 'CIE-1' : sub.assessmentType === 'CIE2' ? 'CIE-2' : sub.assessmentType}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-neutral-900 dark:text-white">
                          {sub.subjectCode}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
                          {sub.subjectName}
                        </div>
                      </td>

                      {/* Allocated Faculty */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{sub.allocatedFaculty?.name || 'Unassigned'}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 pl-5">
                          {sub.allocatedFaculty?.email || '-'}
                        </div>
                      </td>

                      {/* Semester */}
                      <td className="py-3.5 px-4 text-center font-bold text-neutral-700 dark:text-neutral-300">
                        Sem {sub.semester}
                      </td>

                      {/* Students Count */}
                      <td className="py-3.5 px-4 text-center font-bold text-neutral-900 dark:text-white">
                        {sub.studentCount}
                      </td>

                      {/* Submission Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                        {sub.submittedAt ? (
                          <>
                            <div>{new Date(sub.submittedAt).toLocaleDateString()}</div>
                            <div className="text-[10px] text-neutral-400">
                              {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {sub.submissionCount > 1 ? ` • Attempt #${sub.submissionCount}` : ''}
                            </div>
                          </>
                        ) : (
                          <span className="text-neutral-400 italic">Not submitted</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(sub.status, sub.isPublished)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/hod/assessments/${sub.id}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all shadow-xs cursor-pointer ${
                            needsReview
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                              : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{needsReview ? 'Review Marks' : 'View Details'}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodAssessmentManagementPage;

