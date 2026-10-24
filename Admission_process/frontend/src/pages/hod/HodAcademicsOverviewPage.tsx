import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  TrendingUp,
  BookOpen,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  Percent,
  RefreshCw,
} from 'lucide-react';
import hodService from '../../services/hod.service';

export const HodAcademicsOverviewPage: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAcademics = () => {
    setLoading(true);
    hodService.getAcademicsOverview()
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load academics overview:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAcademics();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* ── Page Header (Admin Style) ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-neutral-900 text-white rounded-2xl px-5 py-3 shadow-sm border border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
              Department Average
            </span>
            <div className="text-2xl font-black mt-0.5">
              {data?.averageMarks ?? 0}% <span className="text-xs font-semibold text-neutral-400">score</span>
            </div>
          </div>
          
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchAcademics()}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/hod/academics/bitwise"
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs shadow-sm hover:bg-violet-700 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Bit-Wise Analysis</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            to="/hod/academics/performance"
            className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-xs inline-flex items-center gap-1.5"
          >
            <span>Student Performance Table</span>
          </Link>
        </div>
      </div>

      {/* ── Metric Cards (Admin Style) ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Average Marks</span>
          <h3 className="text-3xl font-black text-neutral-900 dark:text-white mt-2">
            {loading ? '...' : `${data?.averageMarks ?? 0}%`}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Overall internal assessment score</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Pass Rate</span>
          <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {loading ? '...' : `${data?.passPercentage ?? 0}%`}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Scoring ≥ 40% threshold</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Highest Scored</span>
          <h3 className="text-3xl font-black text-neutral-900 dark:text-white mt-2">
            {loading ? '...' : `${data?.highestMarks ?? 0}%`}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Department top performance</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Lowest Scored</span>
          <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {loading ? '...' : `${data?.lowestMarks ?? 0}%`}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Remedial attention required</p>
        </div>
      </div>

      {/* ── Submodule Navigation Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/hod/academics/bitwise"
          className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all block group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-base font-black text-neutral-900 dark:text-white mt-4 group-hover:text-violet-600 transition-colors">
            Bit-Wise Marks Breakdown
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Explore normalized component-level assessments (Bit 1 through Bit 5) across algorithmic, conceptual, and design questions.
          </p>
        </Link>

        <Link
          to="/hod/academics/performance"
          className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all block group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center font-bold">
              <Percent className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-base font-black text-neutral-900 dark:text-white mt-4 group-hover:text-violet-600 transition-colors">
            Student Performance Table
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Holistic academic scorecard tracking attendance percentage, average marks, pass/fail result, and bit-wise component scores.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default HodAcademicsOverviewPage;
