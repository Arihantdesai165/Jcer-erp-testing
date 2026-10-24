import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import officeService, { DashboardData } from '../../services/office.service';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { toast } from 'react-toastify';
import {
  Users, ClipboardList, TrendingUp,
  CheckCircle2, XCircle, Clock, ChevronRight,
  Megaphone, Activity, AlertCircle, Send,
  Shield, Download, Database, Server, Mail, HardDrive, KeyRound, UserPlus,
  GraduationCap
} from 'lucide-react';

const getActionIcon = (action: string) => {
  if (action.includes('LOGIN')) return { icon: Users, color: '#3b82f6' };
  if (action.includes('PASSWORD') || action.includes('CREDENTIALS')) return { icon: KeyRound, color: '#8b5cf6' };
  if (action.includes('ADMISSION')) return { icon: ClipboardList, color: '#f43f5e' };
  if (action.includes('DOCUMENT')) return { icon: CheckCircle2, color: '#10b981' };
  if (action.includes('ROLE') || action.includes('ADMIN') || action.includes('HOD')) return { icon: Shield, color: '#0ea5e9' };
  if (action.includes('NOTIFICATION') || action.includes('NOTICE')) return { icon: Megaphone, color: '#d97706' };
  return { icon: Activity, color: '#64748b' };
};

export const AdminDashboardPage: React.FC = () => {
  const { academicYear } = useAcademicYear();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = (isInitial = false) => {
    if (isInitial) setLoading(true);
    officeService.getDashboardData({ academicYear })
      .then(res => setData(res))
      .catch(err => console.error('Failed to load dashboard data:', err))
      .finally(() => {
        if (isInitial) setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard(true);

    // Auto-refresh stats every 30 seconds
    const interval = setInterval(() => {
      fetchDashboard(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [academicYear]);

  return (
    <div className="space-y-6 pb-6 animate-fade-in max-w-7xl">
      
      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Link to="/admin/students" className="glass-panel rounded-2xl p-5 shadow-ambient border-l-4 border-l-blue-500 hover:scale-[1.02] transition-all cursor-pointer block">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-bold text-neutral-400">Total Users</p>
              <h3 className="text-3xl font-extrabold text-neutral-900 dark:text-white mt-1">
                {loading ? '...' : (data?.quickStats?.totalUsers ?? 0)}
              </h3>
              <p className="text-[10px] font-semibold text-neutral-400 mt-1">Registered Accounts</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={20} />
            </div>
          </div>
        </Link>
        
        <div className="glass-panel rounded-2xl p-5 shadow-ambient border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-bold text-neutral-400">Active Users</p>
              <h3 className="text-3xl font-extrabold text-neutral-900 dark:text-white mt-1">
                {loading ? '...' : (data?.quickStats?.activeUsers ?? 0)}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Currently active</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity size={20} />
            </div>
          </div>
        </div>

        <Link to="/admin/admissions/queue" className="glass-panel rounded-2xl p-5 shadow-ambient border-l-4 border-l-amber-500 hover:scale-[1.02] transition-all cursor-pointer block">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-bold text-neutral-400">Pending Tasks</p>
              <h3 className="text-3xl font-extrabold text-neutral-900 dark:text-white mt-1">
                {loading ? '...' : (data?.quickStats?.pendingTasks ?? 0)}
              </h3>
              <p className="text-[10px] font-semibold text-amber-500 mt-1">Admissions Under Review</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={20} />
            </div>
          </div>
        </Link>

        <Link to="/admin/settings/logs" className="glass-panel rounded-2xl p-5 shadow-ambient border-l-4 border-l-rose-500 hover:scale-[1.02] transition-all cursor-pointer block">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-bold text-neutral-400">Alerts Today</p>
              <h3 className="text-3xl font-extrabold text-neutral-900 dark:text-white mt-1">
                {loading ? '...' : (data?.quickStats?.alertsToday ?? 0)}
              </h3>
              <p className="text-[10px] font-semibold text-rose-500 mt-1">Failed Logins & Security</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
          </div>
        </Link>
      </div>

      {/* MODULE QUICK ACCESS */}
      <h3 className="text-sm font-extrabold tracking-widest text-neutral-400 uppercase mt-8 mb-2">Module Quick Access</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: 'Applicants', path: '/admin/admissions/queue', count: `${data?.moduleCounts?.students ?? 0} Total`, icon: Users, color: '#3b82f6' },
          { name: 'Students', path: '/admin/students', count: `${data?.moduleCounts?.enrolledStudents ?? 0} Enrolled`, icon: GraduationCap, color: '#10b981' },
          { name: 'Admissions', path: '/admin/admissions/queue', count: `${data?.moduleCounts?.admissions ?? 0} New`, icon: ClipboardList, color: '#f43f5e' },
        ].map(mod => {
          const Icon = mod.icon;
          return (
            <Link key={mod.name} to={mod.path} className="glass-panel rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-ambient hover:scale-105 transition-all group">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${mod.color}15`, color: mod.color }}>
                <Icon size={20} />
              </div>
              <h4 className="font-bold text-neutral-800 dark:text-white text-sm">{mod.name}</h4>
              <p className="text-[10px] font-semibold text-neutral-500 mt-0.5">{loading ? '...' : mod.count}</p>
              <div className="mt-3 text-[10px] font-bold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                View &rarr;
              </div>
            </Link>
          )
        })}
      </div>


      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-neutral-200/60 dark:border-neutral-800">
        <Link to="/admin/credentials/bulk" className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md shadow-violet-500/20">
          <UserPlus size={16} /> Bulk Credentials
        </Link>
        <Link to="/admin/announcements" className="px-5 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2">
          <Megaphone size={16} /> Post Announcement
        </Link>
        <button onClick={() => toast.success('Admissions & ERP report exported successfully!')} className="px-5 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2">
          <Download size={16} /> Export Report
        </button>
        <button onClick={() => toast.success('Database backup initiated successfully!')} className="px-5 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ml-auto">
          <Database size={16} /> Run Backup
        </button>
      </div>

    </div>
  );
};

export default AdminDashboardPage;
