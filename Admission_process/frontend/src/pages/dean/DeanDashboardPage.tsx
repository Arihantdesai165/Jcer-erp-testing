import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { toast } from 'react-toastify';
import {
  Building2,
  Users,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Plus,
  FileCheck2,
  Layers,
  ChevronRight,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  GraduationCap,
  Eye,
  Check,
  X,
  XCircle,
  FileText,
  AlertTriangle,
  Info,
} from 'lucide-react';
import deanService, { DeanDashboardData, HodSubjectHandlingRequestRecord } from '../../services/dean.service';
import Skeleton from '../../components/common/Skeleton';

export const DeanDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DeanDashboardData | null>(null);

  // ─── HOD Subject Handling Requests State ─────────────────────────────────
  const [hodSubjectRequests, setHodSubjectRequests] = useState<HodSubjectHandlingRequestRecord[]>([]);
  const [loadingHodRequests, setLoadingHodRequests] = useState<boolean>(true);
  const [hodReqStatusFilter, setHodReqStatusFilter] = useState<string>('ALL');

  // Modals & Action States
  const [viewingRequest, setViewingRequest] = useState<HodSubjectHandlingRequestRecord | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await deanService.getDashboardData();
      setDashboardData(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to load Dean Dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHodSubjectRequests = async () => {
    try {
      setLoadingHodRequests(true);
      const requests = await deanService.getHodSubjectRequests({
        status: hodReqStatusFilter !== 'ALL' ? hodReqStatusFilter : undefined,
      });
      setHodSubjectRequests(requests);
    } catch (err: any) {
      console.error('Failed to load HOD subject handling requests:', err);
    } finally {
      setLoadingHodRequests(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchHodSubjectRequests();

    const handleYearChanged = (e: any) => {
      if (e?.detail?.year) {
        setDashboardData((prev) => (prev ? { ...prev, academicYear: e.detail.year } : prev));
      }
      fetchDashboard();
      fetchHodSubjectRequests();
    };

    window.addEventListener('academic-year-changed', handleYearChanged);
    return () => {
      window.removeEventListener('academic-year-changed', handleYearChanged);
    };
  }, [hodReqStatusFilter]);

  const handleApproveRequest = async (id: string) => {
    try {
      setActionLoading(true);
      const res = await deanService.approveHodSubjectRequest(id);
      toast.success(res.message || 'HOD Subject Handling Request approved successfully. Teaching assignment activated.');
      if (viewingRequest?.id === id) {
        setViewingRequest(null);
      }
      fetchHodSubjectRequests();
      fetchDashboard();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to approve request.';
      toast.error(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (id: string) => {
    setRejectingRequestId(id);
    setRejectionReasonInput('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequestId) return;
    if (!rejectionReasonInput.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await deanService.rejectHodSubjectRequest(rejectingRequestId, rejectionReasonInput.trim());
      toast.success(res.message || 'HOD Subject Handling Request rejected.');
      setIsRejectModalOpen(false);
      setRejectingRequestId(null);
      setRejectionReasonInput('');
      if (viewingRequest?.id === rejectingRequestId) {
        setViewingRequest(null);
      }
      fetchHodSubjectRequests();
      fetchDashboard();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to reject request.';
      toast.error(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="space-y-6">

      {/* ── TOP HERO BANNER (Dark Shiny Navy Blue Style) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] p-6 sm:p-8 text-white border border-[#1e3a8a]/40 shadow-[0_16px_36px_rgba(7,14,34,0.35)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 rounded-full bg-gradient-to-br from-cyan-400/20 via-blue-500/15 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -top-16 left-1/4 w-96 h-40 bg-gradient-to-b from-blue-400/15 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-cyan-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Academic Year {dashboardData?.academicYear || '2026-27'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {getGreeting()}, {user?.firstName ? `${user.firstName}` : 'Dean Academics'} 👋
            </h1>
            <p className="text-sm text-blue-100/90 max-w-xl font-medium">
              Oversee departmental curriculums, faculty appointments, semester structures, and review faculty creation authorization requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/dean/hods/create')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-950/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 border border-blue-400/30 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Create HOD</span>
            </button>
            <button
              onClick={() => navigate('/dean/faculty/authorizations')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs transition-all backdrop-blur-md cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-cyan-300" />
              <span>Review Requests</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col justify-between">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-16 h-8" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <button
            onClick={fetchDashboard}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Departments */}
          <Link
            to="/dean/academic/departments"
            className="group p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Departments
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                {dashboardData?.stats.departments || 0}
              </span>
              <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-blue-600 flex items-center">
                Explore <ChevronRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>
          </Link>

          {/* Card 2: Active HODs */}
          <Link
            to="/dean/hods"
            className="group p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Active HODs
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                {dashboardData?.stats.activeHods || 0}
              </span>
              <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-blue-600 flex items-center">
                Manage <ChevronRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>
          </Link>

          {/* Card 3: Total Faculty */}
          <Link
            to="/dean/faculty"
            className="group p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Total Faculty
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                {dashboardData?.stats.totalFaculty || 0}
              </span>
              <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-emerald-600 flex items-center">
                Directory <ChevronRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>
          </Link>

          {/* Card 4: Pending Requests */}
          <Link
            to="/dean/faculty/authorizations"
            className="group p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 hover:border-rose-400 dark:hover:border-rose-600 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Pending Requests
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                  {dashboardData?.stats.pendingRequests || 0}
                </span>
                {dashboardData?.stats.pendingRequests ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    Needs Action
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-rose-600 flex items-center">
                Review <ChevronRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* ── QUICK ACTIONS SECTION ── */}
      <div className="p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          <button
            onClick={() => navigate('/dean/hods/create')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 hover:bg-blue-500/10 hover:border-blue-400 transition-all text-center group"
          >
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">+ Create HOD</span>
          </button>

          <button
            onClick={() => navigate('/dean/hods/assignments')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 hover:bg-blue-500/10 hover:border-blue-400 transition-all text-center group"
          >
            <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Assign HOD</span>
          </button>

          <button
            onClick={() => navigate('/dean/faculty/authorizations')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 hover:bg-rose-500/10 hover:border-rose-400 transition-all text-center group"
          >
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Review Requests</span>
          </button>

          <button
            onClick={() => navigate('/dean/academic/departments')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 hover:bg-emerald-500/10 hover:border-emerald-400 transition-all text-center group"
          >
            <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">View Departments</span>
          </button>

          <button
            onClick={() => navigate('/dean/faculty/assignments')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 hover:bg-indigo-500/10 hover:border-indigo-400 transition-all text-center group col-span-2 sm:col-span-1"
          >
            <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Faculty Assignments</span>
          </button>

        </div>
      </div>

      {/* ── TWO COLUMN MAIN SECTIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Department Overview Table (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">Department Overview</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Summary of academic branches, active HOD appointments, and student ratios.
                </p>
              </div>
              <Link
                to="/dean/academic/departments"
                className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center"
              >
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
                  <tr>
                    <th className="py-3.5 px-4 font-bold text-white">Department</th>
                    <th className="py-3.5 px-4 font-bold text-white">HOD</th>
                    <th className="py-3.5 px-4 font-bold text-white text-center">Faculty</th>
                    <th className="py-3.5 px-4 font-bold text-white text-center">Students</th>
                    <th className="py-3.5 px-4 font-bold text-white text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {loading ? (
                    [1, 2, 3, 4].map((i) => (
                      <tr key={i}>
                        <td className="py-3 px-4"><Skeleton className="w-24 h-4" /></td>
                        <td className="py-3 px-4"><Skeleton className="w-20 h-4" /></td>
                        <td className="py-3 px-4 text-center"><Skeleton className="w-8 h-4 mx-auto" /></td>
                        <td className="py-3 px-4 text-center"><Skeleton className="w-8 h-4 mx-auto" /></td>
                        <td className="py-3 px-4 text-right"><Skeleton className="w-12 h-4 ml-auto" /></td>
                      </tr>
                    ))
                  ) : dashboardData?.departmentOverview.length ? (
                    dashboardData.departmentOverview.map((dept) => (
                      <tr key={dept.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-neutral-900 dark:text-white block truncate max-w-[140px]" title={dept.name}>
                            {dept.code}
                          </span>
                          <span className="text-[10px] text-neutral-400 truncate block max-w-[140px]">{dept.name}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            onClick={async () => {
                              if (dept.hodId) {
                                navigate(`/dean/hods/${dept.hodId}`);
                                return;
                              }
                              try {
                                const hods = await deanService.getHods({ departmentId: dept.id });
                                const activeHod = hods.find((h) => h.isActive) || hods[0];
                                if (activeHod?.id) {
                                  navigate(`/dean/hods/${activeHod.id}`);
                                  return;
                                }
                              } catch (e) {
                                // fallback
                              }
                              navigate(`/dean/academic/departments/${dept.id}`);
                            }}
                            className={`font-medium text-neutral-700 dark:text-neutral-300 block truncate max-w-[120px] ${
                              dept.hodName !== 'Unassigned' ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''
                            }`}
                            title={dept.hodName !== 'Unassigned' ? 'View HOD Profile' : undefined}
                          >
                            {dept.hodName}
                          </span>
                        </td>
                        <td className="py-3.5 text-center font-semibold text-neutral-600 dark:text-neutral-400">
                          {dept.facultyCount}
                        </td>
                        <td className="py-3.5 text-center font-semibold text-neutral-600 dark:text-neutral-400">
                          {dept.studentCount}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={async () => {
                              if (dept.hodId) {
                                navigate(`/dean/hods/${dept.hodId}`);
                                return;
                              }
                              try {
                                const hods = await deanService.getHods({ departmentId: dept.id });
                                const activeHod = hods.find((h) => h.isActive) || hods[0];
                                if (activeHod?.id) {
                                  navigate(`/dean/hods/${activeHod.id}`);
                                  return;
                                }
                              } catch (e) {
                                // fallback
                              }
                              navigate(`/dean/academic/departments/${dept.id}`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-cyan-300 font-bold text-[11px] transition-all cursor-pointer"
                            title="View HOD Profile & History"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-neutral-400">
                        No departments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Pending Faculty Requests (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">Pending Requests</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  HOD faculty registration requests waiting for Dean sign-off.
                </p>
              </div>
              <Link
                to="/dean/faculty/authorizations"
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center"
              >
                View All →
              </Link>
            </div>

            <div className="space-y-3">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-2">
                    <Skeleton className="w-32 h-4" />
                    <Skeleton className="w-48 h-3" />
                  </div>
                ))
              ) : dashboardData?.pendingRequests.length ? (
                dashboardData.pendingRequests.map((reqItem) => (
                  <div
                    key={reqItem.id}
                    className="p-3.5 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 hover:border-blue-400/60 transition-all bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                          {reqItem.facultyName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/10 text-blue-700 dark:text-cyan-300">
                          {reqItem.departmentCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {reqItem.subject} (Sem {reqItem.semester})
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        {reqItem.createdBy} • {new Date(reqItem.requestedDate).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/dean/faculty/authorizations/${reqItem.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs flex-shrink-0"
                    >
                      Review
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-neutral-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-semibold">No pending authorization requests.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── 🎓 HOD SUBJECT HANDLING REQUESTS SECTION ────────────────────────── */}
      <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-extrabold text-neutral-900 dark:text-white">
                  HOD Subject Handling Requests
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-cyan-300">
                  {hodSubjectRequests.filter((r) => r.status === 'PENDING').length} Pending Review
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Head of Department requests to directly handle and instruct academic subjects. Approving activates teaching assignment on existing HOD profile.
              </p>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 self-start sm:self-auto">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setHodReqStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  hodReqStatusFilter === st
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {st === 'ALL' ? 'All Requests' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">HOD Name</th>
                <th className="py-3.5 px-4 font-bold">Department</th>
                <th className="py-3.5 px-4 font-bold">Semester</th>
                <th className="py-3.5 px-4 font-bold">Subject</th>
                <th className="py-3.5 px-4 font-bold">Subject Code</th>
                <th className="py-3.5 px-4 font-bold">Academic Year</th>
                <th className="py-3.5 px-4 font-bold">Requested On</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {loadingHodRequests ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={9} className="py-4 px-4">
                      <Skeleton className="w-full h-5" />
                    </td>
                  </tr>
                ))
              ) : hodSubjectRequests.length > 0 ? (
                hodSubjectRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {req.hodUser ? `${req.hodUser.firstName} ${req.hodUser.lastName || ''}`.trim() : (req as any).hodName || 'HOD User'}
                      </div>
                      <div className="text-[11px] text-neutral-400">{req.hodUser?.email || (req as any).email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                      <span className="font-bold text-neutral-900 dark:text-white block">
                        {req.department?.code || (req as any).departmentCode || 'DEPT'}
                      </span>
                      <span className="text-[11px] text-neutral-400 block truncate max-w-[120px]">
                        {req.department?.name || (req as any).departmentName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-neutral-800 dark:text-neutral-200">
                      Semester {req.semester}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-neutral-900 dark:text-white">
                      {req.subject?.name || (req as any).subjectName || 'Subject'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-neutral-600 dark:text-neutral-400">
                      {req.subject?.code || (req as any).subjectCode || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-neutral-600 dark:text-neutral-300">
                      {req.academicYear}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-500 text-[11px]">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                        {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                        {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRequest(req)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-[11px] inline-flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>

                        {req.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApproveRequest(req.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 transition-all shadow-xs disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => openRejectModal(req.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] inline-flex items-center gap-1 transition-all shadow-xs disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
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
                  <td colSpan={9} className="py-10 text-center text-neutral-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-sm text-neutral-700 dark:text-neutral-300">
                      No HOD Subject Handling Requests found
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Requests submitted by HODs to instruct courses will appear here for review and sign-off.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 🔍 MODAL: Request Details View Modal ────────────────────────────── */}
      {viewingRequest && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="bg-white dark:bg-neutral-900 rounded-3xl max-w-2xl w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white flex items-center justify-between border-b border-[#1e3a8a]/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center text-cyan-300">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">HOD Subject Handling Request</h3>
                  <p className="text-xs text-blue-200/90 font-medium">
                    Review teaching assignment application details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingRequest(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  viewingRequest.status === 'APPROVED'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                    : viewingRequest.status === 'REJECTED'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  {viewingRequest.status === 'APPROVED' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {viewingRequest.status === 'REJECTED' && <XCircle className="w-4 h-4 text-rose-600" />}
                  {viewingRequest.status === 'PENDING' && <Clock className="w-4 h-4 text-amber-600" />}
                  <span>Application Status: {viewingRequest.status}</span>
                </div>
                <span className="text-[11px] font-medium opacity-80">
                  Requested on {new Date(viewingRequest.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* 1. HOD Information */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>HOD Information</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Name</span>
                    <span className="font-bold text-neutral-900 dark:text-white text-xs">
                      {viewingRequest.hodUser ? `${viewingRequest.hodUser.firstName} ${viewingRequest.hodUser.lastName || ''}`.trim() : (viewingRequest as any).hodName || 'HOD User'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Email</span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300 text-xs">
                      {viewingRequest.hodUser?.email || (viewingRequest as any).email}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Department</span>
                    <span className="font-bold text-neutral-900 dark:text-white text-xs">
                      {viewingRequest.department?.name || (viewingRequest as any).departmentName} ({viewingRequest.department?.code || (viewingRequest as any).departmentCode || 'DEPT'})
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Subject Information */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Subject & Academic Scope</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Semester</span>
                    <span className="font-bold text-neutral-900 dark:text-white text-xs">
                      Semester {viewingRequest.semester}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Subject Code</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white text-xs">
                      {viewingRequest.subject?.code || (viewingRequest as any).subjectCode || 'N/A'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Subject Name</span>
                    <span className="font-bold text-neutral-900 dark:text-white text-xs">
                      {viewingRequest.subject?.name || (viewingRequest as any).subjectName || 'Subject'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Academic Year</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 text-xs">
                      {viewingRequest.academicYear}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Credits</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 text-xs">
                      {viewingRequest.subject?.credits || '4'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Type</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 text-xs">
                      {viewingRequest.subject?.type || 'Theory'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">Assignment Tag</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                      HOD Subject Handling
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Request Details & Notes */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Request Statement / Purpose</span>
                </h4>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60">
                  {viewingRequest.reason || 'No specific reason provided by HOD.'}
                </p>
              </div>

              {/* 4. Review History if decided */}
              {viewingRequest.reviewedAt && (
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    Review Decision Record
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold block">Reviewed By</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {viewingRequest.reviewer ? `${viewingRequest.reviewer.firstName} ${viewingRequest.reviewer.lastName || ''}`.trim() : 'Dean Academics'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold block">Reviewed On</span>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {new Date(viewingRequest.reviewedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {viewingRequest.rejectionReason && (
                    <div className="mt-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300">
                      <strong className="block font-bold mb-0.5">Rejection Reason:</strong>
                      <span>{viewingRequest.rejectionReason}</span>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/60 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewingRequest(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-xs"
              >
                Close
              </button>

              {viewingRequest.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openRejectModal(viewingRequest.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject Request</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveRequest(viewingRequest.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-950/30 transition-all disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Activate Assignment</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ── ❌ MODAL: Rejection Reason Required Modal ───────────────────────── */}
      {isRejectModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="bg-white dark:bg-neutral-900 rounded-3xl max-w-md w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-red-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Reject Subject Request</h3>
                  <p className="text-[11px] text-rose-100 font-medium">Specify rejection reason for HOD</p>
                </div>
              </div>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-neutral-600 dark:text-neutral-400">
                Please provide a clear reason for rejecting this subject handling request. The HOD will be notified with this message.
              </p>

              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  rows={3}
                  placeholder="e.g. Workload threshold reached, subject assigned to dedicated faculty, or schedule clash."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={actionLoading || !rejectionReasonInput.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-md disabled:opacity-50 transition-all"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default DeanDashboardPage;
