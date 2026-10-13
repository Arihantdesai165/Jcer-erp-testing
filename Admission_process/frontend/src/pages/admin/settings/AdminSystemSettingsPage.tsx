import React, { useState, useEffect } from 'react';
import API from '../../../services/api';
import toast from 'react-hot-toast';
import { Settings, ShieldCheck, ShieldAlert, CalendarDays, Loader2, Plus, Sparkles, CheckCircle2, History, ArrowRight } from 'lucide-react';
import { useAcademicYear } from '../../../context/AcademicYearContext';

const AdminSystemSettingsPage: React.FC = () => {
  const { academicYears, activeAcademicYear, refreshAcademicYears, setAcademicYear: setContextViewingYear } = useAcademicYear();
  const [admissionOpen, setAdmissionOpen] = useState<boolean>(true);
  const [academicYear, setAcademicYear] = useState<string>(activeAcademicYear || '2026-27');
  const [closingDate, setClosingDate] = useState<string>('2026-08-31T23:59');
  const [handbookUrl, setHandbookUrl] = useState<string | null>(null);
  const [freshAdmissionOpen, setFreshAdmissionOpen] = useState<boolean>(true);
  const [lateralEntryOpen, setLateralEntryOpen] = useState<boolean>(true);
  const [provisionalAdmissionOpen, setProvisionalAdmissionOpen] = useState<boolean>(true);
  const [provisionalAdmission3Open, setProvisionalAdmission3Open] = useState<boolean>(false);
  const [provisionalAdmission5Open, setProvisionalAdmission5Open] = useState<boolean>(false);
  const [provisionalAdmission7Open, setProvisionalAdmission7Open] = useState<boolean>(false);
  const [copyrightYear, setCopyrightYear] = useState<string>('2026');
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingToggle, setUpdatingToggle] = useState<boolean>(false);
  const [updatingYear, setUpdatingYear] = useState<boolean>(false);
  const [updatingCopyrightYear, setUpdatingCopyrightYear] = useState<boolean>(false);
  const [updatingClosingDate, setUpdatingClosingDate] = useState<boolean>(false);
  const [uploadingHandbook, setUploadingHandbook] = useState<boolean>(false);

  // Dynamic Academic Year Management States
  const [newSingleYear, setNewSingleYear] = useState<string>('');
  const [creatingSingleYear, setCreatingSingleYear] = useState<boolean>(false);
  const [generateStartYear, setGenerateStartYear] = useState<string>('2028-29');
  const [generateCount, setGenerateCount] = useState<number>(5);
  const [generatingYears, setGeneratingYears] = useState<boolean>(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/settings');
      if (res.data?.success && res.data?.data) {
        setAdmissionOpen(res.data.data.admissionOpen ?? true);
        setFreshAdmissionOpen(res.data.data.freshAdmissionOpen ?? true);
        setLateralEntryOpen(res.data.data.lateralEntryOpen ?? true);
        setProvisionalAdmissionOpen(res.data.data.provisionalAdmissionOpen ?? true);
        setProvisionalAdmission3Open(res.data.data.provisionalAdmission3Open ?? false);
        setProvisionalAdmission5Open(res.data.data.provisionalAdmission5Open ?? false);
        setProvisionalAdmission7Open(res.data.data.provisionalAdmission7Open ?? false);
        if (res.data.data.copyrightYear) {
          setCopyrightYear(String(res.data.data.copyrightYear));
          localStorage.setItem('jcer_copyright_year', String(res.data.data.copyrightYear));
        }
        if (res.data.data.admissionCycle) {
          setAcademicYear(res.data.data.admissionCycle);
        }
        if (res.data.data.admissionClosingDate) {
          const d = new Date(res.data.data.admissionClosingDate);
          const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setClosingDate(isoLocal);
        }
        if (res.data.data.handbookUrl) {
          setHandbookUrl(res.data.data.handbookUrl);
        }
      }
    } catch (err: any) {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (newStatus: boolean) => {
    if (updatingToggle) return;
    setUpdatingToggle(true);
    setAdmissionOpen(newStatus); // Optimistic UI update

    try {
      const res = await API.put('/admin/settings', { admissionOpen: newStatus });
      if (res.data?.success) {
        toast.success(newStatus ? 'Admissions are now Open' : 'Admissions are now Closed');
      } else {
        throw new Error(res.data?.error || 'Failed to update setting');
      }
    } catch (err: any) {
      setAdmissionOpen(!newStatus); // Revert on failure
      toast.error(err.response?.data?.error || err.message || 'Failed to update admission status');
    } finally {
      setUpdatingToggle(false);
    }
  };

  const handleToggleSetting = async (field: string, currentValue: boolean, setter: (val: boolean) => void) => {
    const newValue = !currentValue;
    setter(newValue); // Optimistic UI update

    try {
      const res = await API.put('/admin/settings', { [field]: newValue });
      if (res.data?.success) {
        toast.success('Setting updated successfully.');
      } else {
        throw new Error(res.data?.error || 'Failed to update setting');
      }
    } catch (err: any) {
      setter(currentValue); // Revert
      toast.error(err.response?.data?.error || err.message || 'Failed to update setting');
    }
  };

  const handleAcademicYearChange = async (newYear: string) => {
    if (updatingYear || newYear === academicYear) return;
    setUpdatingYear(true);
    const previousYear = academicYear;
    setAcademicYear(newYear); // Optimistic update

    try {
      const res = await API.put('/admin/settings', { academicYear: newYear, admissionCycle: newYear });
      if (res.data?.success) {
        const confirmedYear = res.data.currentYear || res.data.activeAcademicYear || newYear;
        setAcademicYear(confirmedYear);
        setContextViewingYear(confirmedYear);
        await refreshAcademicYears();
        toast.success(`Global Active Academic Year updated to ${confirmedYear}. All dashboards synchronized.`);
      } else {
        throw new Error(res.data?.error || 'Failed to update Academic Year');
      }
    } catch (err: any) {
      setAcademicYear(previousYear); // Revert
      toast.error(err.response?.data?.error || err.message || 'Failed to update Academic Year');
    } finally {
      setUpdatingYear(false);
    }
  };

  const handleCreateSingleAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSingleYear.trim();
    if (!trimmed) {
      toast.error('Please enter an academic year (e.g. 2028-29)');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(trimmed)) {
      toast.error('Invalid format. Please enter format like "2028-29"');
      return;
    }
    const startY = parseInt(trimmed.split('-')[0], 10);
    if (trimmed === '2025-26' || (!isNaN(startY) && startY < 2026)) {
      toast.error('Cannot create academic years prior to the operational starting year 2026-27.');
      return;
    }

    setCreatingSingleYear(true);
    try {
      const res = await API.post('/system/academic-years', { year: trimmed });
      if (res.data?.success) {
        toast.success(`Academic Year ${trimmed} created successfully with configured semesters 1 through 8!`);
        setNewSingleYear('');
        await refreshAcademicYears();
      } else {
        throw new Error(res.data?.error || 'Failed to create academic year');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to create academic year');
    } finally {
      setCreatingSingleYear(false);
    }
  };

  const handleGenerateConsecutiveYears = async () => {
    const trimmed = generateStartYear.trim();
    if (!trimmed || !/^\d{4}-\d{2}$/.test(trimmed)) {
      toast.error('Please provide a valid starting year in "YYYY-YY" format (e.g. 2028-29)');
      return;
    }
    const startY = parseInt(trimmed.split('-')[0], 10);
    if (trimmed === '2025-26' || (!isNaN(startY) && startY < 2026)) {
      toast.error('Starting year cannot be prior to the operational starting year 2026-27.');
      return;
    }

    setGeneratingYears(true);
    try {
      const res = await API.post('/system/academic-years/generate', {
        startYear: trimmed,
        count: generateCount,
      });
      if (res.data?.success) {
        toast.success(res.data.message || `Successfully generated consecutive academic years!`);
        await refreshAcademicYears();
      } else {
        throw new Error(res.data?.error || 'Failed to generate academic years');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to generate academic years');
    } finally {
      setGeneratingYears(false);
    }
  };

  const handleCopyrightYearChange = async (newYear: string) => {
    if (updatingCopyrightYear || newYear === copyrightYear) return;
    setUpdatingCopyrightYear(true);
    const previousYear = copyrightYear;
    setCopyrightYear(newYear);
    localStorage.setItem('jcer_copyright_year', newYear);

    try {
      const res = await API.put('/admin/settings', { copyrightYear: newYear });
      if (res.data?.success) {
        toast.success(`System Copyright Year updated to ${newYear} across all pages!`);
        window.dispatchEvent(new Event('storage'));
      } else {
        throw new Error(res.data?.error || 'Failed to update Copyright Year');
      }
    } catch (err: any) {
      setCopyrightYear(previousYear);
      localStorage.setItem('jcer_copyright_year', previousYear);
      toast.error(err.response?.data?.error || err.message || 'Failed to update Copyright Year');
    } finally {
      setUpdatingCopyrightYear(false);
    }
  };

  const handleClosingDateSave = async () => {
    if (updatingClosingDate) return;
    setUpdatingClosingDate(true);
    try {
      const res = await API.put('/admin/settings', { admissionClosingDate: closingDate });
      if (res.data?.success) {
        toast.success('Admission Closing Date & Time updated successfully');
      } else {
        throw new Error(res.data?.error || 'Failed to update Closing Date');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to update Closing Date');
    } finally {
      setUpdatingClosingDate(false);
    }
  };

  const handleHandbookFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed for Admission Handbook.');
      return;
    }

    setUploadingHandbook(true);
    const formData = new FormData();
    formData.append('handbookPdf', file);

    try {
      const res = await API.post('/admin/settings/handbook', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        const newKey = res.data.handbookKey || res.data.handbookUrl;
        setHandbookUrl(newKey);
        toast.success('Admission Handbook uploaded to Cloudflare R2! Previous version replaced and deleted.');
      } else {
        throw new Error(res.data?.error || 'Failed to upload Handbook PDF');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to upload Handbook PDF');
    } finally {
      setUploadingHandbook(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-sm font-medium text-slate-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center space-x-4">
        <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">System Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure system-wide portal parameters, academic cycles, admission deadlines, handbooks, and access controls.
          </p>
        </div>
      </div>

      {/* Academic Year Control Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Academic Year</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set the active Academic Year dynamically used for new student admissions across the ERP portal.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 space-y-6">
          {/* Active Academic Year Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Current Active Session</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                  {academicYear}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                Newly submitted applications will be automatically tagged with this Academic Year. Existing applications will permanently retain their original session.
              </p>
            </div>

            {/* Academic Year Selector Dropdown */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <label htmlFor="academicYearSelect" className="sr-only">Select Academic Year</label>
              <select
                id="academicYearSelect"
                value={academicYear}
                disabled={updatingYear}
                onChange={(e) => handleAcademicYearChange(e.target.value)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-60"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id || ay.year} value={ay.year}>
                    {ay.year} {ay.year === activeAcademicYear ? '(Current Active)' : ''}
                  </option>
                ))}
              </select>
              {updatingYear && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
            </div>
          </div>

          {/* Academic Years Directory & Quick Activation */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Configured Academic Years</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Centrally managed academic sessions. Semesters 1 through 8 are automatically initialized for each year.
                </p>
              </div>
              <button
                type="button"
                onClick={() => refreshAcademicYears()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Refresh List
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Academic Year</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Session Type</th>
                    <th className="py-2.5 px-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {academicYears.map((ay) => {
                    const isGloballyActive = ay.year === activeAcademicYear;
                    const isUpcoming = ay.status === 'UPCOMING';
                    const isArchived = ay.status === 'ARCHIVED';

                    return (
                      <tr key={ay.id || ay.year} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {ay.year}
                        </td>
                        <td className="py-2.5 px-3">
                          {isGloballyActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Active Institutional
                            </span>
                          ) : isUpcoming ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                              Upcoming
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              <History className="w-3 h-3" />
                              Historical
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          Operational
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isGloballyActive ? (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Current Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={updatingYear}
                              onClick={() => handleAcademicYearChange(ay.year)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Set Active
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create & Generate Academic Years Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Create Single Future Year */}
            <form onSubmit={handleCreateSingleAcademicYear} className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Add Single Future Academic Year
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Register a new upcoming academic year (e.g. 2028-29). It will not be activated automatically.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. 2028-29"
                  value={newSingleYear}
                  onChange={(e) => setNewSingleYear(e.target.value)}
                  disabled={creatingSingleYear}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={creatingSingleYear || !newSingleYear.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {creatingSingleYear ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Create Year</span>
                </button>
              </div>
            </form>

            {/* Generate Multiple Consecutive Future Years */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Generate Multiple Consecutive Years
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically generate a sequence of future years (e.g. 5 years starting from 2028-29).
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Start (e.g. 2028-29)"
                  value={generateStartYear}
                  onChange={(e) => setGenerateStartYear(e.target.value)}
                  disabled={generatingYears}
                  className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={generateCount}
                  onChange={(e) => setGenerateCount(parseInt(e.target.value, 10))}
                  disabled={generatingYears}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={3}>3 Years</option>
                  <option value={5}>5 Years</option>
                  <option value={7}>7 Years</option>
                  <option value={10}>10 Years</option>
                </select>
                <button
                  type="button"
                  onClick={handleGenerateConsecutiveYears}
                  disabled={generatingYears || !generateStartYear.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {generatingYears ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Generate</span>
                </button>
              </div>
            </div>
          </div>

          {/* Historical Retention Notice */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 text-xs">
            <History className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Historical Retention Policy:</span>
              <p className="text-amber-800 dark:text-amber-300/90 text-[11px]">
                The ERP operational baseline starts from Academic Year 2026–27. Legacy 2025–26 records remain securely archived in the database for compliance and audit reporting, and are excluded from normal operational selections.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Copyright Year Control Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">System Copyright Year</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set the dynamic copyright year displayed across all footers and portals in the JCER ERP.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Active Footer Copyright</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                  © {copyrightYear}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                Selecting a year (e.g. 2027) will instantly update the copyright footer across all student, admin, and public ERP pages.
              </p>
            </div>

            {/* Copyright Year Selector Dropdown */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <label htmlFor="copyrightYearSelect" className="sr-only">Select Copyright Year</label>
              <select
                id="copyrightYearSelect"
                value={copyrightYear}
                disabled={updatingCopyrightYear}
                onChange={(e) => handleCopyrightYearChange(e.target.value)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer disabled:opacity-60"
              >
                {['2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032'].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {updatingCopyrightYear && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
            </div>
          </div>
        </div>
      </div>

      {/* Admission Closing Date & Time Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Admission Closing Date & Time</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Single source of truth for the student portal application deadline.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div className="space-y-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white block">Closing Date & Time</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                Displayed dynamically on the Student Dashboard. When this date/time passes, admissions will automatically show as closed.
              </p>
            </div>

            <div className="flex items-center space-x-3 flex-shrink-0">
              <input
                type="datetime-local"
                value={closingDate}
                disabled={updatingClosingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleClosingDateSave}
                disabled={updatingClosingDate}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-colors flex items-center gap-2"
              >
                {updatingClosingDate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admission Handbook PDF Upload Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Admission Handbook PDF Upload (Cloudflare R2)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload or replace the official single PDF handbook stored securely in Cloudflare R2 for student download.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div className="space-y-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white block">Active Handbook Status</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                {handbookUrl
                  ? `Custom PDF handbook active in R2 (${handbookUrl}). Replaces and automatically deletes old file on upload.`
                  : 'Default built-in JCER Admission Handbook template active for student downloads.'}
              </p>
            </div>

            <div className="flex items-center space-x-3 flex-shrink-0">
              <a
                href={`${API.defaults.baseURL || '/api'}/application/handbook`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2"
              >
                View Handbook
              </a>

              <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-colors flex items-center gap-2">
                {uploadingHandbook ? <Loader2 className="w-4 h-4 animate-spin" /> : (handbookUrl ? 'Replace PDF' : 'Upload PDF')}
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={uploadingHandbook}
                  onChange={handleHandbookFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Admission Control Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${admissionOpen ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
              {admissionOpen ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Admission Control</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage global availability for student registrations and new application submissions.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="flex items-center justify-between p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Admission Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${admissionOpen ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'}`}>
                  {admissionOpen ? 'ON — Admissions Open' : 'OFF — Admissions Closed'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                {admissionOpen
                  ? 'Students can freely register, create accounts, and submit new admission applications.'
                  : 'New student registrations and starting new applications are blocked.'}
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={admissionOpen}
                disabled={updatingToggle}
                onClick={() => handleToggle(!admissionOpen)}
                className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  admissionOpen ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                } ${updatingToggle ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    admissionOpen ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admission Track status toggles */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Admission Track Controls</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enable or disable student entry points dynamically for each admission track.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
          
          {/* Fresh Admission Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Fresh Admission (1st Sem)</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Allow new students to register for 1st Semester admission.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('freshAdmissionOpen', freshAdmissionOpen, setFreshAdmissionOpen)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                freshAdmissionOpen ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                freshAdmissionOpen ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Lateral Entry Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Lateral Entry Admission (3rd Sem)</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Allow diploma students to register for direct 3rd Semester lateral admission.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('lateralEntryOpen', lateralEntryOpen, setLateralEntryOpen)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                lateralEntryOpen ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                lateralEntryOpen ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Provisional Admission (Global) Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Provisional Admission (Global Toggle)</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enable or disable provisional admission globally for all eligible semesters.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('provisionalAdmissionOpen', provisionalAdmissionOpen, setProvisionalAdmissionOpen)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                provisionalAdmissionOpen ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                provisionalAdmissionOpen ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Provisional 3 Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Provisional Admission — 3rd Sem</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enable provisional admission applications for promoting students into 3rd Semester.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('provisionalAdmission3Open', provisionalAdmission3Open, setProvisionalAdmission3Open)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                provisionalAdmission3Open ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                provisionalAdmission3Open ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Provisional 5 Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Provisional Admission — 5th Sem</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enable provisional admission applications for promoting students into 5th Semester.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('provisionalAdmission5Open', provisionalAdmission5Open, setProvisionalAdmission5Open)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                provisionalAdmission5Open ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                provisionalAdmission5Open ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Provisional 7 Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Provisional Admission — 7th Sem</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enable provisional admission applications for promoting students into 7th Semester.</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('provisionalAdmission7Open', provisionalAdmission7Open, setProvisionalAdmission7Open)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                provisionalAdmission7Open ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                provisionalAdmission7Open ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminSystemSettingsPage;
