import React from 'react';
import { Users, ChevronRight, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HodFacultyPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link to="/hod/dashboard" className="hover:text-indigo-600 transition-colors">HOD Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-700 dark:text-slate-300">Faculty Management</span>
      </div>

      <div className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Faculty Management
              </h2>
              <p className="text-xs text-slate-500">
                Department teaching roster and faculty profile directories
              </p>
            </div>
          </div>
          <Link
            to="/hod/faculty/authorizations"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Faculty Request</span>
          </Link>
        </div>

        <div className="py-16 px-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 flex items-center justify-center mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
            Faculty Directory Module
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Department faculty roster, workload tracking, and account directories will be available in this module.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HodFacultyPage;
