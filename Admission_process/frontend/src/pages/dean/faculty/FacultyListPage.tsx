import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  FileCheck2,
  Trash2,
  Eye,
  AlertTriangle,
  AlertCircle,
  X,
  Archive,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  RotateCcw,
  Filter
} from 'lucide-react';
import deanService, { FacultyRecord, DepartmentRecord } from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const FacultyListPage: React.FC = () => {
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState<FacultyRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Delete / Archive Modal State
  const [facultyToDelete, setFacultyToDelete] = useState<FacultyRecord | null>(null);
  const [deleteInputText, setDeleteInputText] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  const fetchDependencies = async () => {
    try {
      const depts = await deanService.getDepartments();
      setDepartments(depts);
    } catch (err: any) {
      console.warn('Failed to load departments:', err);
    }
  };

  const fetchFaculty = async (overrideSearch?: string) => {
    try {
      setLoading(true);
      setFetchError(null);
      const activeSearch = typeof overrideSearch === 'string' ? overrideSearch : search;
      const data = await deanService.getFacultyList({
        search: activeSearch.trim() || undefined,
        departmentId: 'ALL',
        status: selectedStatus,
      });
      setFaculty(Array.isArray(data) ? data : []);
      setFetchError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Unable to load faculty directory.';
      setFetchError(msg);
      toast.error('Unable to load faculty directory.', { toastId: 'dean-faculty-load-error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchFaculty();
  }, [selectedStatus]);

  // Combined list of all departments from API and loaded faculty
  const allDepartmentsList = React.useMemo(() => {
    const list = [...departments];
    const existingIds = new Set(list.map((d) => d.id));
    const existingCodes = new Set(list.map((d) => d.code));

    faculty.forEach((f) => {
      if (f.departmentId && !existingIds.has(f.departmentId) && f.departmentCode && !existingCodes.has(f.departmentCode)) {
        list.push({
          id: f.departmentId,
          code: f.departmentCode,
          name: f.departmentName || f.departmentCode,
          facultyCount: 0,
          studentCount: 0,
          subjectCount: 0,
          status: 'ACTIVE',
          createdAt: '',
          hod: null,
        });
        existingIds.add(f.departmentId);
        existingCodes.add(f.departmentCode);
      }
    });

    return list;
  }, [departments, faculty]);

  // Dynamic faculty counts per department
  const deptCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ALL: faculty.length };
    allDepartmentsList.forEach((d) => {
      counts[d.id] = 0;
      counts[d.code] = 0;
    });

    faculty.forEach((f) => {
      if (f.departmentId) {
        counts[f.departmentId] = (counts[f.departmentId] || 0) + 1;
      }
      if (f.departmentCode) {
        counts[f.departmentCode] = (counts[f.departmentCode] || 0) + 1;
      }
    });

    return counts;
  }, [faculty, allDepartmentsList]);

  // Instantly filtered faculty list according to selected department
  const filteredFaculty = React.useMemo(() => {
    if (selectedDept === 'ALL') return faculty;
    return faculty.filter((f) => f.departmentId === selectedDept || f.departmentCode === selectedDept);
  }, [faculty, selectedDept]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFaculty();
  };

  const handleClearSearch = () => {
    setSearch('');
    fetchFaculty('');
  };

  // Open Delete Confirmation Modal
  const handleOpenDeleteModal = (fac: FacultyRecord) => {
    setFacultyToDelete(fac);
    setDeleteInputText('');
  };

  const handleCloseDeleteModal = () => {
    setFacultyToDelete(null);
    setDeleteInputText('');
    setIsArchiving(false);
  };

  // Execute Non-Destructive Soft-Delete / Archive
  const handleConfirmArchive = async () => {
    if (!facultyToDelete || deleteInputText !== 'DELETE') return;

    try {
      setIsArchiving(true);
      await deanService.archiveFaculty(facultyToDelete.id);
      toast.success('Faculty archived successfully.');
      // Remove from active list immediately without full page reload
      setFaculty((prev) => prev.filter((f) => f.id !== facultyToDelete.id));
      handleCloseDeleteModal();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to archive faculty.';
      toast.error(errMsg);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDept('ALL');
    setSelectedStatus('ALL');
    if (selectedStatus === 'ALL') {
      fetchFaculty('');
    }
  };

  const hasActiveFilters = Boolean(
    search.trim() || selectedDept !== 'ALL' || selectedStatus !== 'ALL'
  );
  const activeFiltersCount =
    (search.trim() ? 1 : 0) +
    (selectedDept !== 'ALL' ? 1 : 0) +
    (selectedStatus !== 'ALL' ? 1 : 0);

  const selectedDeptObj = allDepartmentsList.find((d) => d.id === selectedDept || d.code === selectedDept);

  return (
    <div className="space-y-6">

      {/* ── FILTERS PANEL (MATERIALISTIC DESIGN) ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
        {/* Search Row */}
        <div className="px-5 py-3.5 flex flex-wrap lg:flex-nowrap items-center gap-3 border-b border-neutral-100 dark:border-neutral-800">
          {/* Boxed search input */}
          <div className="flex-1 min-w-[260px] flex items-center gap-2.5 px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
            <Search className="shrink-0 text-neutral-400" size={16} />
            <input
              type="text"
              placeholder="Search by faculty name, email, or designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  fetchFaculty();
                }
              }}
              className="flex-1 bg-transparent text-sm text-neutral-800 dark:text-white placeholder:text-neutral-400 outline-none font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 transition-colors text-xs font-bold cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchFaculty()}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Search size={14} />
            Search
          </button>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/dean/faculty/create')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Create Faculty</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/dean/faculty/bulk-import')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Bulk Import</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/dean/faculty/archived')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Archive className="w-4 h-4 text-neutral-500" />
              <span>Archived Faculty</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/dean/faculty/assignments')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Assignments View</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns & Inline Actions */}
        <div className="px-5 pt-4 pb-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            {/* Department */}
            <div className="space-y-1 w-full sm:w-64">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Department
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-[38px]"
              >
                <option value="ALL">All Departments ({deptCounts['ALL'] || 0})</option>
                {allDepartmentsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name} ({deptCounts[d.id] ?? deptCounts[d.code] ?? 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1 w-full sm:w-56">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-[38px]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive / Pending</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            {/* Reset & Apply in one line with Status */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-[38px] flex items-center gap-1.5 px-4 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-neutral-900 text-rose-500 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
              <button
                type="button"
                onClick={() => fetchFaculty()}
                className="h-[38px] flex items-center gap-1.5 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>

          {/* Active filter chips (if any) */}
          {hasActiveFilters && (
            <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                Active Filters:
              </span>
              {search.trim() && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  Search: "{search}"
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedDept !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  Dept: {selectedDeptObj ? selectedDeptObj.code : selectedDept}
                  <button
                    type="button"
                    onClick={() => setSelectedDept('ALL')}
                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  Status: {selectedStatus}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('ALL')}
                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Filter by Department ─────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
            Quick Filter by Department
          </label>
          <span className="text-[11px] font-semibold text-neutral-400">
            {allDepartmentsList.length} Departments
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scroll-smooth no-scrollbar">
          {/* All Departments tab */}
          <button
            type="button"
            onClick={() => setSelectedDept('ALL')}
            className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 h-10 flex items-center gap-2 text-xs font-black shadow-sm cursor-pointer ${
              selectedDept === 'ALL'
                ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span>All Departments</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-colors ${
                selectedDept === 'ALL'
                  ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {deptCounts['ALL'] || 0}
            </span>
          </button>

          {/* Department tabs */}
          {allDepartmentsList.map((d) => {
            const isSelected = selectedDept === d.id || selectedDept === d.code;
            const count = deptCounts[d.id] ?? deptCounts[d.code] ?? 0;

            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDept(d.id)}
                title={`${d.code} - ${d.name}`}
                className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 h-10 flex items-center gap-2 text-xs font-black shadow-sm cursor-pointer group ${
                  isSelected
                    ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
                }`}
              >
                <span>{d.code}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-colors ${
                    isSelected
                      ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                      : count > 0
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Quick Filter by Status ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 dark:text-neutral-500">
          Quick Filter by Status
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth">
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              selectedStatus === 'ALL'
                ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">All</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('ACTIVE')}
            className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              selectedStatus === 'ACTIVE'
                ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">Active</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('INACTIVE')}
            className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              selectedStatus === 'INACTIVE'
                ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">Inactive / Pending</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('SUSPENDED')}
            className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              selectedStatus === 'SUSPENDED'
                ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">Suspended</span>
          </button>
        </div>
      </div>

      {/* ── TABLE CARD ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">College Teaching Faculty Directory</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Active faculty members, department designations, assigned curriculum subjects, and tenure start dates.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {selectedDept === 'ALL'
              ? `Total Active Faculty: ${filteredFaculty.length}`
              : `${selectedDeptObj?.code || 'Department'} Faculty: ${filteredFaculty.length} of ${faculty.length}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-4 font-bold text-white text-center w-16">SL NO</th>
                <th className="py-3.5 px-6 font-bold text-white text-left">Faculty Name</th>
                <th className="py-3.5 px-6 font-bold text-white">Department</th>
                <th className="py-3.5 px-6 font-bold text-white">Official Email</th>
                <th className="py-3.5 px-6 font-bold text-white">Designation</th>
                <th className="py-3.5 px-6 font-bold text-white">Assigned Subjects</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Status</th>
                <th className="py-3.5 px-6 font-bold text-white">Joining Date</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="py-4 px-4 text-center"><Skeleton className="w-6 h-4 mx-auto" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-32 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-32 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-24 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-28 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-16 h-4 mx-auto" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-20 h-4" /></td>
                    <td className="py-4 px-6 text-right"><Skeleton className="w-20 h-4 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredFaculty.length ? (
                filteredFaculty.map((fac, idx) => (
                  <tr key={fac.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-4 px-4 text-center font-bold text-neutral-500 dark:text-neutral-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-6 text-left">
                      <span
                        onClick={() => navigate(`/dean/faculty/${fac.id}`)}
                        className="font-extrabold text-neutral-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer whitespace-nowrap text-left"
                      >
                        {fac.name}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-neutral-800 dark:text-neutral-200">
                      <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
                        {fac.departmentCode}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-neutral-600 dark:text-neutral-400">
                      {fac.email}
                    </td>
                    <td className="py-4 px-6 font-semibold text-neutral-700 dark:text-neutral-300">
                      {fac.designation}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400 font-medium max-w-[200px] truncate">
                      {fac.subjects}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          fac.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {fac.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-neutral-500">
                      {fac.joiningDate ? new Date(fac.joiningDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => navigate(`/dean/faculty/${fac.id}`)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-neutral-700 hover:text-indigo-600 dark:text-neutral-300 dark:hover:text-indigo-400 font-bold text-[11px] transition-all cursor-pointer"
                          title="View Full Faculty Profile & Academic Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(fac)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition-all border border-rose-200/60 dark:border-rose-900/40 cursor-pointer"
                          title="Delete / Archive Faculty"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : fetchError ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400 space-y-3">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-rose-500" />
                      <p className="font-bold text-rose-600 dark:text-rose-400 text-sm">Unable to load faculty directory</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm">{fetchError}</p>
                      <button
                        onClick={() => fetchFaculty()}
                        className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-neutral-400">
                    {selectedDept === 'ALL'
                      ? 'No active faculty records found.'
                      : `No faculty records found for department ${selectedDeptObj?.name || selectedDeptObj?.code || selectedDept}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2-STEP CONFIRMATION MODAL BEFORE ARCHIVE / DELETE ── */}
      {facultyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 sm:p-7 space-y-5">
            
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white">Delete Faculty?</h3>
                  <p className="text-xs text-neutral-500">Non-destructive soft-delete & archive protocol</p>
                </div>
              </div>
              <button
                onClick={handleCloseDeleteModal}
                disabled={isArchiving}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content info */}
            <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
              <p>
                You are about to remove <strong className="text-neutral-900 dark:text-white font-bold">{facultyToDelete.name}</strong> ({facultyToDelete.email}) from the active Faculty Directory.
              </p>
              <p className="text-neutral-500 dark:text-neutral-400">
                This will deactivate the faculty login account and remove the faculty from active teaching allocation dropdowns.
              </p>

              {/* Data Safety Preservation Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 space-y-2">
                <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Academic History is Preserved</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                  Existing academic records such as:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 font-medium text-amber-900 dark:text-amber-200">
                  <li>Attendance sessions & student attendance records</li>
                  <li>Continuous Internal Evaluation (CIE) & marks</li>
                  <li>Curriculum assessments & components</li>
                  <li>Faculty assignments & teaching history</li>
                  <li>System audit logs</li>
                </ul>
                <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 pt-1">
                  The faculty will be safely archived and accessible anytime under <span className="underline font-bold">Archived Faculty</span>.
                </p>
              </div>

              {/* Step 2 Confirmation Input */}
              <div className="pt-2 space-y-2">
                <label className="block text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                  To confirm removal, type <span className="font-extrabold text-rose-600 dark:text-rose-400 tracking-wider">DELETE</span> in the box below:
                </label>
                <input
                  type="text"
                  value={deleteInputText}
                  onChange={(e) => setDeleteInputText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  disabled={isArchiving}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={handleCloseDeleteModal}
                disabled={isArchiving}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArchive}
                disabled={deleteInputText !== 'DELETE' || isArchiving}
                className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                  deleteInputText === 'DELETE' && !isArchiving
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 cursor-pointer'
                    : 'bg-neutral-400 dark:bg-neutral-700 opacity-50 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>{isArchiving ? 'Archiving Faculty...' : 'Delete Faculty'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default FacultyListPage;
