import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../../../services/api';
import { 
  Activity, ShieldAlert, Search, Filter, RotateCcw, RefreshCw, Loader2, Eye, Download, 
  User, Clock, Globe, FileText, CheckCircle2, XCircle, AlertTriangle, Calendar, ChevronLeft, ChevronRight, X, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-toastify';

export interface AuditLogItem {
  id: string;
  action: string;
  userId: string | null;
  userName: string;
  userRole: string;
  userEmail: string | null;
  ipAddress: string;
  userAgent: string | null;
  details: any;
  studentName?: string | null;
  applicationNumber?: string | null;
  admissionId?: string | null;
  createdAt: string;
}

const ACTION_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  LOGIN_SUCCESS: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/40' },
  LOGIN_FAILED: { bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-900/40' },
  LOGOUT: { bg: 'bg-slate-100 dark:bg-neutral-800', text: 'text-slate-700 dark:text-neutral-300', border: 'border-slate-200 dark:border-neutral-700' },
  GENERATE_CREDENTIALS: { bg: 'bg-violet-50 dark:bg-violet-950/20', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-900/40' },
  PASSWORD_RESET: { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900/40' },
  ADMISSION_SUBMIT: { bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-900/40' },
  ADMISSION_VIEW: { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-900/40' },
  DOCUMENT_DOWNLOAD: { bg: 'bg-cyan-50 dark:bg-cyan-950/20', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-900/40' },
  ADMISSION_STEP_EDIT: { bg: 'bg-sky-50 dark:bg-sky-950/20', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-900/40' },
  ADMISSION_STATUS_UPDATE: { bg: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-900/40' },
  ADMIN_VERIFIED_DOCUMENTS: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/40' },
  SENT_FOR_CORRECTION: { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900/40' },
  ADMISSION_REJECTED: { bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-900/40' },
  ADMISSION_APPROVED: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/40' },
  PRINCIPAL_ENROLL: { bg: 'bg-teal-50 dark:bg-teal-950/20', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-900/40' },
};

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination & Modal State
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 300 };
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await API.get('/admin/logs', { params });
      if (res.data?.success) {
        setLogs(res.data.data || []);
      } else {
        toast.error('Failed to load activity logs.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to retrieve system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, startDate, endDate]);

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
    toast.info('Log filters reset.');
  };

  // Filter logs by search keyword on client (User, Action, Student Name, Application Number, IP, Details)
  const filteredLogs = logs.filter(log => {
    if (!search.trim()) return true;
    const query = search.toLowerCase().trim();
    const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : '';
    return (
      log.action.toLowerCase().includes(query) ||
      log.userName.toLowerCase().includes(query) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(query)) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(query)) ||
      (log.studentName && log.studentName.toLowerCase().includes(query)) ||
      (log.applicationNumber && log.applicationNumber.toLowerCase().includes(query)) ||
      (log.admissionId && log.admissionId.toLowerCase().includes(query)) ||
      detailsStr.includes(query)
    );
  });

  // Calculate Metrics
  const totalLogsCount = logs.length;
  const securityEventsCount = logs.filter(l => ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'GENERATE_CREDENTIALS', 'PASSWORD_RESET'].includes(l.action)).length;
  const adminActionsCount = logs.filter(l => l.userRole === 'ADMIN' || l.userRole === 'SUPER_ADMIN').length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogsCount = logs.filter(l => l.createdAt && l.createdAt.slice(0, 10) === todayStr).length;

  // Pagination logic
  const pageSize = 15;
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.warning('No activity logs available to export.');
      return;
    }
    const headers = ['Log ID', 'Timestamp', 'User', 'Role', 'Email', 'Action', 'Student Name', 'Application Number', 'Admission ID', 'IP Address', 'Details'];
    const rows = filteredLogs.map(l => [
      l.id,
      new Date(l.createdAt).toLocaleString(),
      `"${l.userName}"`,
      l.userRole,
      l.userEmail || 'N/A',
      l.action,
      `"${l.studentName || '—'}"`,
      `"${l.applicationNumber || '—'}"`,
      `"${l.admissionId || '—'}"`,
      l.ipAddress,
      `"${l.details ? JSON.stringify(l.details).replace(/"/g, '""') : 'N/A'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `JCER_Activity_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Activity logs exported as CSV.');
  };

  const getActionBadge = (action: string) => {
    const style = ACTION_COLOR_MAP[action] || {
      bg: 'bg-neutral-100 dark:bg-neutral-800',
      text: 'text-neutral-700 dark:text-neutral-300',
      border: 'border-neutral-200 dark:border-neutral-700'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}>
        {action.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12 text-neutral-900 dark:text-neutral-100">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-3">
            <Activity className="text-violet-600 dark:text-violet-400" size={28} />
            System Activity & Audit Logs
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-1">
            Real-time security trail, administrative actions, login events, and user operation records.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-violet-600' : ''} />
            Refresh Logs
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-violet-600/10 cursor-pointer"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total Logs */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="size-11 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Total Activity Logs</span>
            <p className="text-xl font-black text-neutral-900 dark:text-white mt-0.5">{totalLogsCount}</p>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="size-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Today's Logs</span>
            <p className="text-xl font-black text-neutral-900 dark:text-white mt-0.5">{todayLogsCount}</p>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="size-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Admin Operations</span>
            <p className="text-xl font-black text-neutral-900 dark:text-white mt-0.5">{adminActionsCount}</p>
          </div>
        </div>

        {/* Security & Sessions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="size-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Security Events</span>
            <p className="text-xl font-black text-neutral-900 dark:text-white mt-0.5">{securityEventsCount}</p>
          </div>
        </div>

      </div>

      {/* Filter & Search Panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          
          {/* Keyword Search */}
          <div className="space-y-1 sm:col-span-2 md:col-span-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
              Search Logs
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="User name, email, action, IP..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full h-10 pl-9 pr-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            </div>
          </div>

          {/* Action Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
              Action Type
            </label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/25 cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN_SUCCESS">LOGIN SUCCESS</option>
              <option value="LOGIN_FAILED">LOGIN FAILED</option>
              <option value="LOGOUT">LOGOUT</option>
              <option value="GENERATE_CREDENTIALS">GENERATE CREDENTIALS</option>
              <option value="PASSWORD_RESET">PASSWORD RESET</option>
              <option value="ADMISSION_SUBMIT">ADMISSION SUBMIT</option>
              <option value="ADMISSION_VIEW">ADMISSION VIEW</option>
              <option value="DOCUMENT_DOWNLOAD">DOCUMENT DOWNLOAD</option>
              <option value="ADMISSION_STEP_EDIT">ADMISSION STEP EDIT</option>
              <option value="ADMISSION_STATUS_UPDATE">STATUS UPDATE</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/25"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
              End Date
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/25"
              />
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 h-10 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center shrink-0 cursor-pointer"
                title="Reset Filters"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-violet-600" size={32} />
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Loading system activity logs...</p>
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="p-20 text-center space-y-3">
            <Activity className="mx-auto text-neutral-300 dark:text-neutral-700" size={48} />
            <h3 className="text-base font-extrabold text-neutral-800 dark:text-white">No Activity Logs Found</h3>
            <p className="text-xs font-semibold text-neutral-500 max-w-md mx-auto">
              There are no audit log events matching the selected filters. Try broadening your filter parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/20">
                  <th className="py-4 px-4 w-12 text-center">#</th>
                  <th className="py-4 px-4">Timestamp</th>
                  <th className="py-4 px-4">User / Actor</th>
                  <th className="py-4 px-4">Action</th>
                  <th className="py-4 px-4">Student / Application</th>
                  <th className="py-4 px-4">IP Address</th>
                  <th className="py-4 px-4">Activity Summary</th>
                  <th className="py-4 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/40 text-xs font-semibold">
                {paginatedLogs.map((log, idx) => {
                  const logIndex = (page - 1) * pageSize + idx + 1;
                  const detailsPreview = log.details 
                    ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details))
                    : 'N/A';

                  return (
                    <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10 transition-colors">
                      <td className="py-4 px-4 text-center text-neutral-400 font-bold">
                        {logIndex}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-neutral-800 dark:text-neutral-200 font-medium">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-neutral-400 shrink-0" />
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div>
                          <p className="font-bold text-neutral-900 dark:text-white">{log.userName}</p>
                          <p className="text-[10px] font-semibold text-neutral-400 mt-0.5 uppercase tracking-wider">
                            {log.userRole} {log.userEmail ? `• ${log.userEmail}` : ''}
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {log.studentName || log.applicationNumber ? (
                          <div>
                            <p className="font-bold text-neutral-900 dark:text-white leading-tight">
                              {log.studentName || 'Student Name Unavailable'}
                            </p>
                            {log.applicationNumber ? (
                              <p className="font-mono text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 mt-0.5 tracking-wider">
                                {log.applicationNumber}
                              </p>
                            ) : (
                              <p className="text-[10px] text-neutral-400 mt-0.5 font-medium">
                                {log.admissionId ? `ID: ${log.admissionId.slice(0, 8)}...` : '—'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-semibold">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                        <div className="flex items-center gap-1.5">
                          <Globe size={13} className="text-neutral-400 shrink-0" />
                          {log.ipAddress}
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-xs truncate text-neutral-600 dark:text-neutral-400 font-mono text-[11px]">
                        {detailsPreview}
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-xl transition-all cursor-pointer border border-transparent hover:border-violet-100/50"
                          title="Inspect Full Payload"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && paginatedLogs.length > 0 && (
          <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              Showing <span className="font-black text-neutral-900 dark:text-white">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-black text-neutral-900 dark:text-white">{Math.min(page * pageSize, filteredLogs.length)}</span> of{' '}
              <span className="font-black text-neutral-900 dark:text-white">{filteredLogs.length}</span> log records
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-extrabold px-3 text-neutral-700 dark:text-neutral-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Inspection Modal */}
      {selectedLog && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-2xl p-6 space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Activity size={20} className="text-violet-600" />
                <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                  Audit Log Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-4 p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-200/50 dark:border-neutral-800">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Action</span>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Timestamp</span>
                  <p className="font-bold text-neutral-900 dark:text-white mt-1">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Performed By</span>
                  <p className="font-bold text-neutral-900 dark:text-white mt-0.5">{selectedLog.userName}</p>
                  <p className="text-[10px] text-neutral-400">{selectedLog.userRole} {selectedLog.userEmail ? `• ${selectedLog.userEmail}` : ''}</p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">IP Address</span>
                  <p className="font-mono text-neutral-900 dark:text-white mt-1">{selectedLog.ipAddress}</p>
                </div>
              </div>

              {(selectedLog.studentName || selectedLog.applicationNumber || selectedLog.admissionId) && (
                <div className="p-4 bg-violet-50/60 dark:bg-violet-950/20 rounded-2xl border border-violet-100 dark:border-violet-900/30 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 block">Student Name</span>
                    <p className="font-bold text-neutral-900 dark:text-white mt-0.5">{selectedLog.studentName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 block">Application No</span>
                    <p className="font-mono font-bold text-neutral-900 dark:text-white mt-0.5">{selectedLog.applicationNumber || '—'}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 block">Admission ID</span>
                    <p className="font-mono text-[11px] text-neutral-600 dark:text-neutral-300 truncate mt-0.5">{selectedLog.admissionId || '—'}</p>
                  </div>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">User Agent</span>
                  <p className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400 p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200/50 dark:border-neutral-800 break-all">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">JSON Payload Details</span>
                <pre className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 p-4 bg-neutral-900 text-white rounded-2xl overflow-x-auto max-h-60">
                  {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : 'No details payload.'}
                </pre>
              </div>

            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminAuditLogsPage;
