import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Cloud,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Power,
  HardDrive,
  FolderTree,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Database,
  Info,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import googleDriveService, { GoogleDriveStatus } from '../../../services/googleDrive.service';

export const DeanGoogleDriveBackupPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [retryingBackups, setRetryingBackups] = useState<boolean>(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [selectedDeptPreview, setSelectedDeptPreview] = useState<'CSE' | 'CSE-AIML' | 'ECE' | 'ME' | 'CV'>('CSE');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await googleDriveService.getStatus();
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to load Google Drive status:', err);
      toast.error('Failed to load Google Drive connection status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Check URL parameters for OAuth redirect callback status
    const statusParam = searchParams.get('status');
    const emailParam = searchParams.get('email');
    const messageParam = searchParams.get('message');

    if (statusParam === 'success') {
      toast.success(`Google Drive connected successfully${emailParam ? ` (${emailParam})` : ''}!`);
      setSearchParams({});
    } else if (statusParam === 'error') {
      toast.error(messageParam || 'Failed to connect Google Drive.');
      setSearchParams({});
    }
  }, []);

  // Close disconnect modal on Escape key
  useEffect(() => {
    if (!disconnectModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disconnecting) {
        setDisconnectModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disconnectModalOpen, disconnecting]);

  const handleConnect = async () => {
    try {
      const authUrl = await googleDriveService.getAuthUrl();
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate Google authorization.');
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const res = await googleDriveService.testConnection();
      if (res.success) {
        toast.success(res.message || 'Google Drive connection is healthy and verified!');
      } else {
        toast.error(res.message || 'Google Drive connection test failed.');
      }
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Connection test failed.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleToggleAutoBackup = async () => {
    if (!status || !isConnected) return;
    const newEnabled = !status.autoBackupEnabled;
    try {
      await googleDriveService.toggleAutoBackup(newEnabled);
      setStatus({ ...status, autoBackupEnabled: newEnabled });
      toast.success(`Automatic Google Drive backup is now ${newEnabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update auto-backup setting.');
    }
  };

  const handleRetryFailed = async () => {
    try {
      setRetryingBackups(true);
      const res = await googleDriveService.retryFailedBackups();
      const retriedCount = Number(res?.retriedCount ?? 0) || 0;
      toast.success(retriedCount > 0 ? `Queued ${retriedCount} backup(s) for retry.` : 'No pending/failed backups to retry.');
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to trigger backup retries.');
    } finally {
      setRetryingBackups(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      const res = await googleDriveService.disconnect();
      toast.info(res.message || 'Google Drive disconnected.');
      setDisconnectModalOpen(false);
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to disconnect.');
    } finally {
      setDisconnecting(false);
    }
  };

  // Safe normalized variables
  const isConnected = Boolean(
    (status?.connected || status?.isConnected) &&
    (status?.accountEmail || status?.googleAccountEmail)
  );

  const isError = Boolean(status?.status === 'ERROR' || (status?.lastError && isConnected));
  const authorizedEmail = (status?.accountEmail || status?.googleAccountEmail || '').trim();
  const rootFolderName = isConnected ? (status?.rootFolderName || status?.rootFolder || 'JCER ERP Attendance') : 'Not created yet';

  const pendingBackups = Number(status?.pendingBackups ?? status?.pendingJobsCount ?? status?.stats?.pendingBackups ?? 0) || 0;
  const failedBackups = Number(status?.failedBackups ?? status?.failedJobsCount ?? status?.stats?.failedBackups ?? 0) || 0;
  const activeWorkbooks = Number(status?.activeWorkbooks ?? status?.totalSyncedFiles ?? status?.stats?.activeWorkbooks ?? 0) || 0;
  const totalRetryCount = pendingBackups + failedBackups;

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-12">
      {/* ── Header Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold tracking-wide uppercase border border-white/15 text-blue-200">
              <ShieldCheck className="size-3.5 text-blue-300" />
              <span>College-Wide Academic Archive System</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Google Drive Attendance Backup</h1>
            <p className="text-blue-200/80 text-sm max-w-2xl">
              Automatic asynchronous backup of faculty attendance registers to official college Google Drive spreadsheets. PostgreSQL remains the authoritative primary source of truth.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-sm font-medium border border-white/20 transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Integration Card ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Main Status & Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 p-6 md:p-8 shadow-sm backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className={`size-14 rounded-2xl flex items-center justify-center shadow-md transition-colors ${
                  isConnected && !isError
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/50'
                    : isError
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/50'
                    : 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700'
                }`}>
                  <Cloud className="size-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-100">Integration Status</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {loading ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                        <RefreshCw className="size-3 animate-spin" />
                        Verifying...
                      </span>
                    ) : isConnected && !isError ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        Connected & Active
                      </span>
                    ) : isError ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        <span className="size-2 rounded-full bg-rose-500" />
                        Connection Error
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300">
                        <span className="size-2 rounded-full bg-slate-400" />
                        Not Connected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Automatic Backup Switch (Only interactive when connected) */}
              {isConnected && (
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-neutral-800/60 px-4 py-2.5 rounded-2xl border border-slate-200/60 dark:border-neutral-700/60">
                  <div className="text-left">
                    <p className="text-xs font-semibold text-slate-900 dark:text-neutral-200">Auto Backup</p>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400">On attendance save</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAutoBackup}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      status?.autoBackupEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        status?.autoBackupEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Connection Details */}
            <div className="py-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Authorized Google Account</span>
                  <p className={`text-sm font-semibold mt-1 truncate ${
                    isConnected ? 'text-slate-900 dark:text-neutral-100' : 'text-slate-500 dark:text-neutral-400 italic'
                  }`}>
                    {isConnected ? authorizedEmail : 'Not connected'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Target Root Folder</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <FolderTree className={`size-4 ${isConnected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                    <p className={`text-sm font-semibold truncate ${
                      isConnected ? 'text-slate-900 dark:text-neutral-100' : 'text-slate-500 dark:text-neutral-400 italic'
                    }`}>
                      {rootFolderName}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Last Successful Sync</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className={`size-4 ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    <p className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
                      {status?.lastSuccessfulSync || status?.lastSyncAt
                        ? new Date(status.lastSuccessfulSync || status.lastSyncAt!).toLocaleString('en-GB')
                        : 'No files synced yet'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">OAuth Refresh Token</span>
                  <div className={`flex items-center gap-1.5 mt-1 ${
                    isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}>
                    <ShieldCheck className="size-4" />
                    <p className="text-sm font-semibold">
                      {isConnected ? 'Stored Securely (AES-256-GCM)' : 'Not configured'}
                    </p>
                  </div>
                </div>
              </div>

              {status?.lastError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-800 dark:text-rose-200">
                  <AlertTriangle className="size-5 flex-shrink-0 mt-0.5 text-rose-600" />
                  <div className="text-xs">
                    <p className="font-semibold">Last Backup Notice:</p>
                    <p className="mt-0.5 opacity-90">{status.lastError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 dark:border-neutral-800">
              {!isConnected ? (
                <button
                  type="button"
                  onClick={handleConnect}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm shadow-md transition-all duration-200"
                >
                  <Cloud className="size-4" />
                  <span>Connect Google Drive</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 active:scale-95 text-slate-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 disabled:opacity-50"
                  >
                    <RefreshCw className={`size-4 ${testingConnection ? 'animate-spin' : ''}`} />
                    <span>{testingConnection ? 'Testing Connection...' : 'Test Connection'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    disabled={retryingBackups || totalRetryCount === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-medium text-sm border border-amber-200/60 dark:border-amber-900/40 transition-all duration-200 disabled:opacity-40"
                  >
                    <RefreshCw className={`size-4 ${retryingBackups ? 'animate-spin' : ''}`} />
                    <span>Retry Backups ({totalRetryCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDisconnectModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-medium text-sm border border-rose-200/60 dark:border-rose-900/40 transition-all duration-200 ml-auto"
                  >
                    <Power className="size-4" />
                    <span>Disconnect</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Architecture & Flow Banner */}
          <div className="rounded-3xl border border-slate-200/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
              <Database className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>Architectural Guarantees & Fault Tolerance</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs text-slate-600 dark:text-neutral-400">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-800 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-neutral-200">1. Instant Faculty Response</p>
                <p>PostgreSQL transaction commits first. Faculty never waits for Excel generation or Google Drive network latency.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-800 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-neutral-200">2. Non-Blocking Resilience</p>
                <p>If Google Drive is unavailable, attendance in PostgreSQL remains 100% intact and the backup queue automatically retries.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-800 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-neutral-200">3. Single Subject Workbook</p>
                <p>One workbook per subject cohort is updated continuously with dynamic session columns (e.g. 02-10-2026 P1).</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Metrics & Structure */}
        <div className="space-y-6">
          {/* Sync Metrics Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-blue-600" />
              <span>Backup Metrics</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/50">
                <span className="text-xs font-medium text-slate-600 dark:text-neutral-400">Active Workbooks</span>
                <span className="text-sm font-bold text-slate-900 dark:text-neutral-100">
                  {activeWorkbooks}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/50">
                <span className="text-xs font-medium text-slate-600 dark:text-neutral-400">Pending Backups</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {pendingBackups}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/50">
                <span className="text-xs font-medium text-slate-600 dark:text-neutral-400">Failed / Retrying</span>
                <span className={`text-sm font-bold ${failedBackups > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-neutral-100'}`}>
                  {failedBackups}
                </span>
              </div>
            </div>
          </div>

          {/* Folder Hierarchy Preview Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
              <FolderTree className="size-4 text-emerald-600" />
              <span>Automatic Folder Hierarchy</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-3">
              Workbooks are organized with permanent Top-Level Department folders, followed by Academic Year, Semester, and Section:
            </p>

            {/* Department inspect selector */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <span className="text-xs text-slate-400 font-medium mr-1">Inspect:</span>
              {(['CSE', 'CSE-AIML', 'ECE', 'ME', 'CV'] as const).map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDeptPreview(dept)}
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedDeptPreview === dept
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-xs space-y-1 overflow-x-auto shadow-inner">
              <p className="text-blue-400 font-bold">JCER ERP Attendance/</p>

              {/* CSE */}
              <p className={`pl-3 ${selectedDeptPreview === 'CSE' ? 'text-blue-300 font-bold' : 'text-slate-300'}`}>├── CSE/</p>
              {selectedDeptPreview === 'CSE' ? (
                <>
                  <p className="pl-6 text-slate-400">│   └── 2026-27/</p>
                  <p className="pl-6 text-slate-400">│       ├── Semester 1/</p>
                  <p className="pl-6 text-slate-400">│       │   ├── Section A/</p>
                  <p className="pl-6 text-emerald-400 font-semibold">│       │   │   ├── Attendance_DBMS_SecA_2026-27.xlsx</p>
                  <p className="pl-6 text-emerald-400 font-semibold">│       │   │   └── Attendance_Java_SecA_2026-27.xlsx</p>
                  <p className="pl-6 text-slate-400">│       │   └── Section B/</p>
                  <p className="pl-6 text-slate-400">│       └── Semester 2/</p>
                </>
              ) : (
                <p className="pl-6 text-slate-500">│   └── 2026-27/</p>
              )}

              {/* CSE-AIML */}
              <p className={`pl-3 ${selectedDeptPreview === 'CSE-AIML' ? 'text-blue-300 font-bold' : 'text-slate-300'}`}>├── CSE-AIML/</p>
              {selectedDeptPreview === 'CSE-AIML' ? (
                <>
                  <p className="pl-6 text-slate-400">│   └── 2026-27/</p>
                  <p className="pl-6 text-slate-400">│       ├── Semester 1/</p>
                  <p className="pl-6 text-slate-400">│       │   ├── Section A/</p>
                  <p className="pl-6 text-emerald-400 font-semibold">│       │   │   └── Attendance_AIMath_SecA_2026-27.xlsx</p>
                  <p className="pl-6 text-slate-400">│       │   └── Section B/</p>
                  <p className="pl-6 text-slate-400">│       └── Semester 2/</p>
                </>
              ) : (
                <p className="pl-6 text-slate-500">│   └── 2026-27/</p>
              )}

              {/* ECE */}
              <p className={`pl-3 ${selectedDeptPreview === 'ECE' ? 'text-blue-300 font-bold' : 'text-slate-300'}`}>├── ECE/</p>
              {selectedDeptPreview === 'ECE' ? (
                <>
                  <p className="pl-6 text-slate-400">│   └── 2026-27/</p>
                  <p className="pl-6 text-slate-400">│       ├── Semester 1/</p>
                  <p className="pl-6 text-slate-400">│       │   └── Section A/</p>
                  <p className="pl-6 text-emerald-400 font-semibold">│       │       └── Attendance_Signals_SecA_2026-27.xlsx</p>
                  <p className="pl-6 text-slate-400">│       └── Semester 2/</p>
                </>
              ) : (
                <p className="pl-6 text-slate-500">│   └── 2026-27/</p>
              )}

              {/* ME */}
              <p className={`pl-3 ${selectedDeptPreview === 'ME' ? 'text-blue-300 font-bold' : 'text-slate-300'}`}>├── ME/</p>
              {selectedDeptPreview === 'ME' ? (
                <>
                  <p className="pl-6 text-slate-400">│   └── 2026-27/</p>
                  <p className="pl-6 text-slate-400">│       ├── Semester 1/</p>
                  <p className="pl-6 text-slate-400">│       │   └── Section A/</p>
                  <p className="pl-6 text-emerald-400 font-semibold">│       │       └── Attendance_Thermodynamics_SecA_2026-27.xlsx</p>
                  <p className="pl-6 text-slate-400">│       └── Semester 2/</p>
                </>
              ) : (
                <p className="pl-6 text-slate-500">│   └── 2026-27/</p>
              )}

              {/* CV */}
              <p className={`pl-3 ${selectedDeptPreview === 'CV' ? 'text-blue-300 font-bold' : 'text-slate-300'}`}>└── CV/</p>
              {selectedDeptPreview === 'CV' ? (
                <>
                  <p className="pl-6 text-slate-400">    └── 2026-27/</p>
                  <p className="pl-6 text-slate-400">        ├── Semester 1/</p>
                  <p className="pl-6 text-slate-400">        │   └── Section A/</p>
                  <p className="pl-6 text-emerald-400 font-semibold">        │       └── Attendance_Surveying_SecA_2026-27.xlsx</p>
                  <p className="pl-6 text-slate-400">        └── Semester 2/</p>
                </>
              ) : (
                <p className="pl-6 text-slate-500">    └── 2026-27/</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Disconnect Confirmation Dialog (rendered via Portal directly to body) ── */}
      {disconnectModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => !disconnecting && setDisconnectModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="disconnect-modal-title"
          >
            <div
              className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-slate-200/90 dark:border-neutral-800 overflow-hidden space-y-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with warning accent badge & close button */}
              <div className="px-6 py-5 bg-gradient-to-r from-rose-50/80 via-rose-50/30 to-transparent dark:from-rose-950/40 dark:via-rose-950/10 dark:to-transparent border-b border-rose-100/80 dark:border-rose-950/60 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="size-11 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-900/60 shadow-xs">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <h3 id="disconnect-modal-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                      Disconnect Google Drive?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
                      Revoke automated attendance cloud backup
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => !disconnecting && setDisconnectModalOpen(false)}
                  disabled={disconnecting}
                  className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close dialog"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                <p className="text-xs leading-relaxed text-slate-600 dark:text-neutral-300">
                  Automatic attendance backup will pause immediately until a Google account is re-authorized.
                </p>

                {/* Target Account Summary Card */}
                {isConnected && (
                  <div className="rounded-2xl border border-slate-200/90 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-850 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-neutral-400 font-medium">Connected Account</span>
                      <span className="font-bold text-slate-900 dark:text-neutral-100 font-mono text-[11px] bg-white dark:bg-neutral-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-neutral-700">
                        {authorizedEmail}
                      </span>
                    </div>
                    {rootFolderName && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-neutral-800">
                        <span className="text-slate-500 dark:text-neutral-400 font-medium">Root Backup Folder</span>
                        <span className="font-semibold text-slate-700 dark:text-neutral-300 text-[11px]">
                          📁 {rootFolderName}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Data Safety Reassurance */}
                <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 p-3 flex items-start gap-2.5">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-normal font-medium">
                    <strong>Data Integrity Guaranteed:</strong> All historical Excel spreadsheets in your Google Drive and attendance session records in PostgreSQL remain <strong>100% intact</strong>.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-neutral-900/90 border-t border-slate-100 dark:border-neutral-800/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDisconnectModalOpen(false)}
                  disabled={disconnecting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                >
                  {disconnecting ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Disconnecting...</span>
                    </>
                  ) : (
                    <>
                      <Power className="size-3.5" />
                      <span>Yes, Disconnect</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DeanGoogleDriveBackupPage;
