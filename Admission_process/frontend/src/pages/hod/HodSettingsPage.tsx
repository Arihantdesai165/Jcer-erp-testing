import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { toast } from 'react-toastify';
import {
  Settings,
  Building2,
  Lock,
  Percent,
  AlertTriangle,
  RefreshCw,
  Save,
  RotateCcw,
  Info,
  Calendar,
  Send,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import hodService from '../../services/hod.service';
import { useAcademicYear } from '../../context/AcademicYearContext';

export const HodSettingsPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();

  const [loading, setLoading] = useState<boolean>(true);
  const [settingsData, setSettingsData] = useState<any | null>(null);

  // Attendance Threshold Form State
  const [thresholdInput, setThresholdInput] = useState<string>('85');
  const [savedThreshold, setSavedThreshold] = useState<number>(85);
  const [savingThreshold, setSavingThreshold] = useState<boolean>(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const deptCode = user?.department?.code || 'AS';
  const deptName = user?.department?.name || 'Department';

  useEffect(() => {
    fetchSettings();
  }, [academicYear]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await hodService.getSettings({ academicYear });
      setSettingsData(data);
      const currentThreshold = data?.attendanceThreshold ?? data?.department?.attendanceThreshold ?? 85;
      setSavedThreshold(Number(currentThreshold));
      setThresholdInput(String(currentThreshold));
      setInputError(null);
    } catch (err) {
      console.error('Failed to load department settings:', err);
      toast.error('Failed to load department configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdInputChange = (val: string) => {
    setThresholdInput(val);
    if (val.trim() === '') {
      setInputError('Threshold percentage is required.');
      return;
    }
    const num = Number(val);
    if (isNaN(num)) {
      setInputError('Must be a valid numeric percentage.');
    } else if (num < 0 || num > 100) {
      setInputError('Percentage must be between 0 and 100.');
    } else {
      setInputError(null);
    }
  };

  const handleResetThreshold = () => {
    setThresholdInput(String(savedThreshold));
    setInputError(null);
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputError || thresholdInput.trim() === '') {
      toast.error(inputError || 'Please provide a valid attendance threshold.');
      return;
    }

    const num = Number(thresholdInput);
    if (isNaN(num) || num < 0 || num > 100) {
      toast.error('Attendance threshold must be a valid percentage between 0 and 100.');
      return;
    }

    setSavingThreshold(true);
    try {
      const res = await hodService.updateDepartmentSettings({
        attendanceThreshold: num,
        academicYear,
      });

      const updatedVal = res?.data?.attendanceThreshold ?? num;
      setSavedThreshold(updatedVal);
      setThresholdInput(String(updatedVal));
      setInputError(null);
      toast.success(`🎉 Department Attendance Threshold updated to ${updatedVal}%!`);
      fetchSettings();
    } catch (err: any) {
      console.error('Failed to save threshold:', err);
      const errMsg = err?.response?.data?.error || 'Failed to save attendance threshold.';
      toast.error(errMsg);
    } finally {
      setSavingThreshold(false);
    }
  };

  const isDirty = thresholdInput !== String(savedThreshold);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Department Settings
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/hod/publish"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish Attendance & Marks</span>
            </Link>
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>AY: {academicYear}</span>
            </span>
            <button
              onClick={fetchSettings}
              disabled={loading}
              title="Refresh Configuration"
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Assigned Department Scope (Locked Context Card) ────────────────────── */}
      <div className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Assigned Department Scope</span>
          </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                <Lock className="w-3 h-3" /> PERMANENTLY LOCKED
              </span>
            </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-medium block">Department Name:</span>
              <strong className="text-slate-900 dark:text-white text-sm">
                {settingsData?.department?.name || deptName}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Department Code:</span>
              <strong className="text-slate-900 dark:text-white font-mono text-sm">
                {settingsData?.department?.code || deptCode}
              </strong>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
            Note: HOD accounts are strictly scoped to their appointed department. Settings and attendance policies configured here apply only to students and cohorts under this department.
          </p>
        </div>
      </div>

      {/* ── Attendance Threshold Configuration Card ──────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Attendance Threshold Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Define the minimum expected attendance percentage for students in the department.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Current Threshold:</span>
            <span className="px-3 py-1 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-mono font-black text-sm border border-violet-200 dark:border-violet-800">
              {savedThreshold}%
            </span>
          </div>
        </div>

        {/* Threshold Edit Form */}
        <form onSubmit={handleSaveThreshold} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Minimum Required Attendance (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={thresholdInput}
                  onChange={(e) => handleThresholdInputChange(e.target.value)}
                  placeholder="e.g. 85"
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm font-bold text-slate-900 dark:text-white outline-none transition-all ${
                    inputError
                      ? 'border-rose-500 ring-2 ring-rose-200 dark:ring-rose-950/40'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500'
                  }`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  %
                </span>
              </div>
              {inputError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{inputError}</span>
                </p>
              )}
            </div>

            <div className="sm:pt-6 flex flex-col justify-end">
              <p className="text-[11px] text-slate-500">
                Institutional Default: <strong className="text-slate-700 dark:text-slate-300">85.0%</strong>. Valid range: 0.0% – 100.0%. Saved thresholds are scoped to <strong>{deptCode}</strong> and <strong>AY {academicYear}</strong>.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={savingThreshold || Boolean(inputError) || !isDirty}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{savingThreshold ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>

            {isDirty && (
              <button
                type="button"
                onClick={handleResetThreshold}
                disabled={savingThreshold}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Changes</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default HodSettingsPage;
