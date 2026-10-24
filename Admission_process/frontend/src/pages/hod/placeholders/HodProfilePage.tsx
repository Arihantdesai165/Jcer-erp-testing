import React from 'react';
import { useSelector } from 'react-redux';
import { User, Building2, Mail, Phone, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RootState } from '../../../store';

export const HodProfilePage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link to="/hod/dashboard" className="hover:text-indigo-600 transition-colors">HOD Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-700 dark:text-slate-300">HOD Profile</span>
      </div>

      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
          <img
            src={user?.profileImage || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&fit=crop'}
            alt="Profile Avatar"
            className="w-24 h-24 rounded-3xl object-cover ring-4 ring-indigo-500/20 shadow-md"
          />
          <div className="text-center sm:text-left space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Head of Department
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mt-2">
              {user?.name || 'Dr. Rahul Sharma'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Department: <span className="font-bold text-slate-800 dark:text-slate-200">{user?.department?.name || 'Computer Science & Engineering'} ({user?.department?.code || 'CSE'})</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <Mail className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{user?.email}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <Phone className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{user?.phone || 'Not configured'}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <Building2 className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Department</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{user?.department?.name || 'Computer Science & Engineering'}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Year</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">2026-27 (Active)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HodProfilePage;
