import React from 'react';
import { Settings, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HodSettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link to="/hod/dashboard" className="hover:text-indigo-600 transition-colors">HOD Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-700 dark:text-slate-300">Settings</span>
      </div>

      <div className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              HOD Account & Preferences
            </h2>
            <p className="text-xs text-slate-500">
              Department preferences, notification configurations, and security settings
            </p>
          </div>
        </div>

        <div className="py-16 px-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mb-3">
            <Settings className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
            Account Preferences Module
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Password changes, notification digests, and departmental preferences can be configured here.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HodSettingsPage;
