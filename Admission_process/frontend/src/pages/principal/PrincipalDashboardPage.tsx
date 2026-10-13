import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Users, 
  AlertTriangle, 
  ArrowRight, 
  Clock, 
  BarChart3,
  FileText,
  UserCheck,
  Ban,
  ShieldCheck
} from 'lucide-react';
import admissionService, { AdmissionApplication } from '../../services/admission.service';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { toast } from 'react-toastify';

export const PrincipalDashboardPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<{
    pendingPrincipal: number;
    approvedToday: number;
    rejectedToday: number;
    admissionConfirmed: number;
    cancellationRequests: number;
    cancelledAdmissions: number;
  }>({
    pendingPrincipal: 0,
    approvedToday: 0,
    rejectedToday: 0,
    admissionConfirmed: 0,
    cancellationRequests: 0,
    cancelledAdmissions: 0,
  });

  const [pendingApplications, setPendingApplications] = useState<AdmissionApplication[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch pending applications awaiting Principal approval (status: APPROVED)
      const pendingRes = await admissionService.listApplications({
        status: 'APPROVED',
        academicYear,
        limit: 5,
        sortBy: 'updatedAt',
        sortOrder: 'DESC'
      });

      // Fetch enrolled/approved applications
      const enrolledRes = await admissionService.listApplications({
        status: 'ENROLLED',
        academicYear,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'DESC'
      });

      // Fetch rejected applications
      const rejectedRes = await admissionService.listApplications({
        status: 'REJECTED',
        academicYear,
        limit: 5,
        sortBy: 'updatedAt',
        sortOrder: 'DESC'
      });

      // Fetch cancellation requested
      const cancelReqRes = await admissionService.listApplications({
        status: 'CANCELLATION_REQUESTED',
        academicYear,
        limit: 5
      });

      // Fetch cancelled
      const cancelledRes = await admissionService.listApplications({
        status: 'CANCELLED',
        academicYear,
        limit: 5
      });

      // Calculate Today's counts
      const todayStr = new Date().toISOString().split('T')[0];
      
      const appTodayCount = enrolledRes.applications.filter(a => 
        a.updatedAt && a.updatedAt.startsWith(todayStr)
      ).length;

      const rejTodayCount = rejectedRes.applications.filter(a => 
        a.updatedAt && a.updatedAt.startsWith(todayStr)
      ).length;

      setStats({
        pendingPrincipal: pendingRes.total || 0,
        approvedToday: appTodayCount,
        rejectedToday: rejTodayCount,
        admissionConfirmed: enrolledRes.total || 0,
        cancellationRequests: cancelReqRes.total || 0,
        cancelledAdmissions: cancelledRes.total || 0,
      });

      setPendingApplications(pendingRes.applications || []);

      // Build Recent Activities feed
      const activities: any[] = [];

      enrolledRes.applications.slice(0, 5).forEach(app => {
        const studentName = app.user ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim() : 'Student';
        activities.push({
          id: `app-${app.id}`,
          type: 'APPROVED',
          title: 'Admission Approved & Signed off',
          student: studentName,
          appNo: app.applicationNumber,
          branch: app.branch?.code || 'N/A',
          timestamp: app.updatedAt,
        });
      });

      rejectedRes.applications.slice(0, 5).forEach(app => {
        const studentName = app.user ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim() : 'Student';
        activities.push({
          id: `rej-${app.id}`,
          type: 'REJECTED',
          title: 'Returned / Rejected Application',
          student: studentName,
          appNo: app.applicationNumber,
          branch: app.branch?.code || 'N/A',
          timestamp: app.updatedAt,
        });
      });

      cancelledRes.applications.slice(0, 3).forEach(app => {
        const studentName = app.user ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim() : 'Student';
        activities.push({
          id: `can-${app.id}`,
          type: 'CANCELLED',
          title: 'Admission Cancelled',
          student: studentName,
          appNo: app.applicationNumber,
          branch: app.branch?.code || 'N/A',
          timestamp: app.updatedAt,
        });
      });

      // Sort by latest timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities.slice(0, 6));

    } catch (err: any) {
      console.error('Error loading Principal Dashboard data:', err);
      toast.error('Unable to fetch admission dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [academicYear]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-28 bg-neutral-200 dark:bg-neutral-800 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-neutral-200 dark:bg-neutral-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded-3xl" />
      </div>
    );
  }

  const summaryCards = [
    {
      id: 'pending',
      title: 'Pending Principal Approvals',
      count: stats.pendingPrincipal,
      description: 'Applications verified by Admin awaiting sign-off',
      icon: ClipboardList,
      color: 'bg-amber-500',
      textColor: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40',
      actionPath: '/principal/admissions/pending',
    },
    {
      id: 'approved-today',
      title: 'Admissions Approved Today',
      count: stats.approvedToday,
      description: 'Total sign-offs completed today',
      icon: CheckCircle2,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-700 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40',
      actionPath: '/principal/admissions/approved',
    },
    {
      id: 'rejected-today',
      title: 'Admissions Rejected Today',
      count: stats.rejectedToday,
      description: 'Returned/Rejected applications today',
      icon: XCircle,
      color: 'bg-rose-500',
      textColor: 'text-rose-700 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40',
      actionPath: '/principal/admissions/rejected',
    },
    {
      id: 'confirmed',
      title: 'Admission Confirmed',
      count: stats.admissionConfirmed,
      description: 'Total enrolled & approved admissions',
      icon: UserCheck,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-700 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40',
      actionPath: '/principal/admissions/approved',
    },
    {
      id: 'cancellation-req',
      title: 'Cancellation Requests',
      count: stats.cancellationRequests,
      description: 'Student cancellation requests submitted',
      icon: AlertTriangle,
      color: 'bg-orange-500',
      textColor: 'text-orange-700 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40',
      actionPath: '/principal/admissions/history?status=CANCELLATION_REQUESTED',
    },
    {
      id: 'cancelled',
      title: 'Cancelled Admissions',
      count: stats.cancelledAdmissions,
      description: 'Total cancelled student admissions',
      icon: Ban,
      color: 'bg-slate-500',
      textColor: 'text-slate-700 dark:text-slate-400',
      bgColor: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
      actionPath: '/principal/admissions/history?status=CANCELLED',
    },
  ];

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* ═══ HEADER BANNER ═══ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-extrabold uppercase tracking-widest border border-white/10 text-indigo-300">
              <ShieldCheck size={14} />
              Principal Admission Control Center
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Welcome back, {user?.name || 'Principal'}
            </h1>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed font-medium">
              Review verified admission files, sign off confirmed applications, and audit enrollment operations for Session {academicYear}.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0">
            <div className="size-12 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center border border-indigo-400/20">
              <ClipboardList size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Awaiting Your Approval</p>
              <p className="text-2xl font-black text-amber-400">{stats.pendingPrincipal} Applications</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TOP SUMMARY CARDS ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={() => navigate(card.actionPath)}
              className={`group cursor-pointer p-5 rounded-2xl border ${card.bgColor} shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`size-10 rounded-xl ${card.color} text-white flex items-center justify-center shadow-md`}>
                  <Icon size={20} />
                </div>
                <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">
                  {card.count}
                </p>
                <h3 className={`text-xs font-bold ${card.textColor} leading-snug mb-1`}>
                  {card.title}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-2">
                  {card.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ PRIORITY SECTION: APPLICATIONS REQUIRING PRINCIPAL DECISION ═══ */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                ⚠️ Applications Requiring Principal Decision
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Verified by Admission Office & awaiting final authorization
              </p>
            </div>
          </div>
          {pendingApplications.length > 0 && (
            <Link
              to="/principal/admissions/pending"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 shrink-0"
            >
              View All ({stats.pendingPrincipal}) <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {pendingApplications.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-20 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No applications are awaiting Principal approval.
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                All submitted applications have been processed. New verified applications will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#111111] dark:bg-neutral-950 text-white font-extrabold uppercase text-[11px] tracking-wider border-b border-neutral-800">
                  <th className="py-3.5 px-4">Admission No</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4">Branch</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Verified By</th>
                  <th className="py-3.5 px-4">Verified Date</th>
                  <th className="py-3.5 px-4 text-center">Priority</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {pendingApplications.map((app) => {
                  const pd = app.studentpersonaldetails;
                  const studentName = pd
                    ? `${pd.firstName} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName}`.replace(/\s+/g, ' ').trim()
                    : app.user
                      ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim()
                      : 'Guest Applicant';
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                        {app.applicationNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {studentName}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-indigo-600 dark:text-indigo-400">
                        {app.branch?.code || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-600">
                        {app.admissionType || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {app.reviewedBy || 'Admission Officer'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-medium">
                        {app.verifiedAt ? new Date(app.verifiedAt).toLocaleDateString() : app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : 'Recent'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-black uppercase">
                          HIGH
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate(`/principal/admissions/review/${app.id}`)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Dynamic Count Summary Bar ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/90 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-850/70 text-xs text-slate-600 dark:text-neutral-300 select-none">
              <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
                <span>
                  Total: <strong className="font-extrabold text-slate-900 dark:text-white">{pendingApplications.length}</strong> student{pendingApplications.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ LOWER SECTION: RECENT ACTIVITY & QUICK ACTIONS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Clock size={18} />
              </div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Recent Principal Actions
              </h2>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audit Feed</span>
          </div>

          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No recent actions recorded today.</p>
            ) : (
              recentActivities.map((act) => (
                <div key={act.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 text-white ${
                      act.type === 'APPROVED' ? 'bg-emerald-500' : act.type === 'REJECTED' ? 'bg-rose-500' : 'bg-slate-500'
                    }`}>
                      {act.type === 'APPROVED' ? <CheckCircle2 size={16} /> : act.type === 'REJECTED' ? <XCircle size={16} /> : <Ban size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {act.title}: <span className="text-indigo-600 font-extrabold">{act.student}</span> ({act.appNo})
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Branch: {act.branch}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0 ml-2">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-neutral-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Quick Actions
            </h2>
            <p className="text-xs text-slate-500">Shortcuts to main Principal portals</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/principal/admissions')}
              className="p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40 text-left transition-all hover:-translate-y-0.5 space-y-2"
            >
              <ClipboardList size={22} className="text-indigo-600" />
              <div>
                <p className="text-xs font-black">Review Admissions</p>
                <p className="text-[10px] text-slate-500 font-medium">Queue & Sign-off</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/principal/students')}
              className="p-4 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-100 dark:border-teal-900/40 text-left transition-all hover:-translate-y-0.5 space-y-2"
            >
              <Users size={22} className="text-teal-600" />
              <div>
                <p className="text-xs font-black">Students</p>
                <p className="text-[10px] text-slate-500 font-medium">Directory & Search</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/principal/analytics')}
              className="p-4 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/40 text-left transition-all hover:-translate-y-0.5 space-y-2"
            >
              <BarChart3 size={22} className="text-purple-600" />
              <div>
                <p className="text-xs font-black">Analytics</p>
                <p className="text-[10px] text-slate-500 font-medium">Visual Charts</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/principal/reports')}
              className="p-4 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40 text-left transition-all hover:-translate-y-0.5 space-y-2"
            >
              <FileText size={22} className="text-blue-600" />
              <div>
                <p className="text-xs font-black">Reports</p>
                <p className="text-[10px] text-slate-500 font-medium">Export Excel/PDF</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrincipalDashboardPage;
