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
import deanService, { DeanDashboardData } from '../../services/dean.service';
import Skeleton from '../../components/common/Skeleton';
import { useAcademicYear } from '../../context/AcademicYearContext';

export const DeanDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DeanDashboardData | null>(null);

  const fetchDashboard = async (ay?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await deanService.getDashboardData({ academicYear: ay || academicYear });
      setDashboardData(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to load Dean Dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(academicYear);
  }, [academicYear]);

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
            onClick={() => fetchDashboard()}
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
                {dashboardData?.stats?.departments || 0}
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
                {dashboardData?.stats?.activeHods || 0}
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
                {dashboardData?.stats?.totalFaculty || 0}
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
                  {dashboardData?.stats?.pendingRequests || 0}
                </span>
                {dashboardData?.stats?.pendingRequests ? (
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
                  ) : dashboardData?.departmentOverview?.length ? (
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
              ) : dashboardData?.pendingRequests?.length ? (
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

          </div>
  );
};

export default DeanDashboardPage;
