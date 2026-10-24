import React from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HodNotificationsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link to="/hod/dashboard" className="hover:text-indigo-600 transition-colors">HOD Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-700 dark:text-slate-300">Notifications</span>
      </div>

      <div className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Notifications & Announcements
            </h2>
            <p className="text-xs text-slate-500">
              Administrative circulars, faculty approval alerts, and institutional notices
            </p>
          </div>
        </div>

        <div className="py-16 px-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center mb-3">
            <Bell className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
            No New Notifications
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            You're all caught up! New notices from Dean Academics or Principal will appear in this feed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HodNotificationsPage;
