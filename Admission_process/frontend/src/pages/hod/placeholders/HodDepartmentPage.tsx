import React, { useState, useEffect } from 'react';
import { Building2, Users, BookOpen, Layers, ShieldCheck, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import hodService, { HodDepartmentInfo } from '../../../services/hod.service';

export const HodDepartmentPage: React.FC = () => {
  const [data, setData] = useState<HodDepartmentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hodService.getDepartmentInfo()
      .then((res) => setData(res))
      .catch((err) => console.warn('Could not load department info:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link to="/hod/dashboard" className="hover:text-indigo-600 transition-colors">HOD Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-700 dark:text-slate-300">My Department</span>
      </div>

      <div className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {data?.department?.name || 'Department Academic Profile'}
              </h2>
              <p className="text-xs text-slate-500">
                Department Code: <span className="font-bold text-indigo-600">{data?.department?.code || 'CSE'}</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active Department
          </span>
        </div>

        {/* Content Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faculty Members</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {loading ? '...' : (data?.facultyList?.length ?? 0)}
            </h3>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subjects Mapped</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {loading ? '...' : (data?.subjectsList?.length ?? 0)}
            </h3>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Department Status</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              Active
            </h3>
          </div>
        </div>

        <div className="mt-8 py-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs font-bold text-slate-500">
            Detailed department academic management modules will be enabled in upcoming releases.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HodDepartmentPage;
