import React, { useState } from 'react';
import { toast } from 'react-toastify';
import {
  FileText,
  Download,
  CalendarCheck,
  Users,
  Award,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';

export const HodReportsPage: React.FC = () => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (reportName: string) => {
    setDownloading(reportName);
    setTimeout(() => {
      setDownloading(null);
      toast.success(`${reportName} generated and exported successfully.`);
    }, 1200);
  };

  const reports = [
    {
      id: 'attendance-defaulters',
      title: 'Attendance Defaulters Report (< 75%)',
      desc: 'Complete list of all department students with critical attendance deficit below mandatory 75% threshold, including parent contacts.',
      icon: CalendarCheck,
      color: 'rose',
    },
    {
      id: 'student-directory',
      title: 'Department Students Master Directory',
      desc: 'Full roster of active students in the department organized by semester and section, with enrollment IDs and batch years.',
      icon: Users,
      color: 'blue',
    },
    {
      id: 'academic-performance',
      title: 'Academic Marks & Bit-Wise Component Summary',
      desc: 'Assessment analytics across IA1, IA2, and Bit 1-5 performance averages with pass/fail breakdown.',
      icon: Award,
      color: 'indigo',
    },
    {
      id: 'faculty-assignments',
      title: 'Faculty Workload & Permissions Matrix',
      desc: 'Audit report of all teaching allotments, subject mappings, and academic access grants.',
      icon: Layers,
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Department Reports Center
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Download formal PDF, Excel, and CSV academic documentation for executive review and compliance audits.
            </p>
          </div>
        </div>
      </div>

      {/* ── Reports Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reports.map((r) => {
          const Icon = r.icon;
          const isDownloading = downloading === r.title;

          return (
            <div
              key={r.id}
              className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-xs hover:shadow-md transition-all bg-white/80 dark:bg-slate-900/80 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Official Report
                  </span>
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {r.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {r.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">PDF / CSV Export</span>
                <button
                  onClick={() => handleDownload(r.title)}
                  disabled={isDownloading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HodReportsPage;
