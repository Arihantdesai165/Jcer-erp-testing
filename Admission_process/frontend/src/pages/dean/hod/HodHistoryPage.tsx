import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Users, Building2, Calendar, CheckCircle2 } from 'lucide-react';
import deanService from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';

export const HodHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await deanService.getHodHistory();
        setHistory(data);
      } catch (err) {
        toast.error('Failed to load HOD assignment history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6">

      {/* ── BACK BUTTON ── */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => navigate('/dean/hods')}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to HOD Directory</span>
        </button>
      </div>

      {/* ── TABLE CARD ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-amber-600" />
            <span>Complete HOD Assignment History</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Institutional ledger of all past and current Head of Department appointments across academic sessions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-6 font-bold text-white">Head of Department</th>
                <th className="py-3.5 px-6 font-bold text-white">Department</th>
                <th className="py-3.5 px-6 font-bold text-white">Academic Year</th>
                <th className="py-3.5 px-6 font-bold text-white">Tenure Start Date</th>
                <th className="py-3.5 px-6 font-bold text-white">Tenure End Date</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Status</th>
                <th className="py-3.5 px-6 font-bold text-white">Appointed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="py-4 px-6"><Skeleton className="w-32 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-24 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-20 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-20 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-16 h-4 mx-auto" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-24 h-4" /></td>
                  </tr>
                ))
              ) : history.length ? (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-4 px-6 font-bold text-neutral-900 dark:text-white">
                      <div>
                        <span>{item.hodName}</span>
                        <span className="text-[10px] text-neutral-400 block font-normal">{item.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-neutral-800 dark:text-neutral-200">
                      {item.departmentName} ({item.departmentCode})
                    </td>
                    <td className="py-4 px-6 font-semibold text-neutral-700 dark:text-neutral-300">
                      {item.academicYear}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400">
                      {new Date(item.startDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400">
                      {item.endDate ? new Date(item.endDate).toLocaleDateString() : 'Active Ongoing'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : item.status === 'COMPLETED'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-neutral-500">
                      {item.assignedBy}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    No historical records available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default HodHistoryPage;
