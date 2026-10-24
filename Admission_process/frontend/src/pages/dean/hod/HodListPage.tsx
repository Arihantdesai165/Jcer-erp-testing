import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, UserCheck, Eye, History, UserPlus, Trash2, AlertTriangle, Loader2, SlidersHorizontal, RotateCcw, Filter, X } from 'lucide-react';
import deanService, { HodRecord, DepartmentRecord } from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const HodListPage: React.FC = () => {
  const navigate = useNavigate();
  const [hods, setHods] = useState<HodRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [selectedHodToDelete, setSelectedHodToDelete] = useState<HodRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchDependencies = async () => {
    try {
      const depts = await deanService.getDepartments();
      setDepartments(depts);
    } catch (err) {
      toast.error('Failed to load departments');
    }
  };

  const fetchHods = async (overrideSearch?: string) => {
    try {
      setLoading(true);
      const activeSearch = overrideSearch !== undefined ? overrideSearch : search;
      const data = await deanService.getHods({
        search: activeSearch.trim() || undefined,
        departmentId: selectedDept,
        status: selectedStatus,
      });
      setHods(data);
    } catch (err) {
      toast.error('Failed to load HODs');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (hod: HodRecord) => {
    setSelectedHodToDelete(hod);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedHodToDelete) return;
    try {
      setIsDeleting(true);
      await deanService.deleteHod(selectedHodToDelete.id);
      toast.success(`HOD ${selectedHodToDelete.name} deleted successfully`);
      setDeleteModalOpen(false);
      setSelectedHodToDelete(null);
      fetchHods();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to delete HOD';
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchHods();
  }, [selectedDept, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHods();
  };

  const handleClearSearch = () => {
    setSearch('');
    fetchHods('');
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDept('ALL');
    setSelectedStatus('ALL');
    if (selectedDept === 'ALL' && selectedStatus === 'ALL') {
      fetchHods('');
    }
  };

  const hasActiveFilters = Boolean(
    search.trim() || selectedDept !== 'ALL' || selectedStatus !== 'ALL'
  );
  const activeFiltersCount =
    (search.trim() ? 1 : 0) +
    (selectedDept !== 'ALL' ? 1 : 0) +
    (selectedStatus !== 'ALL' ? 1 : 0);

  const selectedDeptObj = departments.find((d) => d.id === selectedDept);

  return (
    <div className="space-y-6">

      {/* ── FILTERS PANEL (MATERIALISTIC DESIGN) ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
        {/* Search Row */}
        <div className="px-5 py-3.5 flex flex-wrap lg:flex-nowrap items-center gap-3 border-b border-neutral-100 dark:border-neutral-800">
          {/* Boxed search input */}
          <div className="flex-1 min-w-[240px] flex items-center gap-2.5 px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
            <Search className="shrink-0 text-neutral-400" size={16} />
            <input
              type="text"
              placeholder="Search by HOD name, email, or order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  fetchHods();
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
            onClick={() => fetchHods()}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Search size={14} />
            Search
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/dean/hods/history')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <History className="w-4 h-4 text-neutral-500" />
              <span>HOD History</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/dean/hods/create')}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create HOD</span>
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
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
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
                <option value="ACTIVE">Active Tenure</option>
                <option value="INACTIVE">Relieved / Inactive</option>
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
                onClick={() => fetchHods()}
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
                  Status: {selectedStatus === 'ACTIVE' ? 'Active' : 'Relieved'}
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
            <span className="w-full text-center leading-none">Inactive</span>
          </button>
        </div>
      </div>

      {/* ── TABLE CARD ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">Heads of Department (HOD) Directory</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Active and past academic department heads appointed by Dean Academics.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-4 font-bold text-white text-center w-16">SL NO</th>
                <th className="py-3.5 px-6 font-bold text-white text-left">HOD Name</th>
                <th className="py-3.5 px-6 font-bold text-white">Department</th>
                <th className="py-3.5 px-6 font-bold text-white">Email</th>
                <th className="py-3.5 px-6 font-bold text-white">Academic Year</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Status</th>
                <th className="py-3.5 px-6 font-bold text-white">Tenure Start</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="py-4 px-4 text-center"><Skeleton className="w-6 h-4 mx-auto" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-32 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-20 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-32 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-16 h-4 mx-auto" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-20 h-4" /></td>
                    <td className="py-4 px-6 text-right"><Skeleton className="w-24 h-4 ml-auto" /></td>
                  </tr>
                ))
              ) : hods.length ? (
                hods.map((h, idx) => (
                  <tr key={h.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-4 px-4 text-center font-bold text-neutral-500 dark:text-neutral-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-6 text-left">
                      <span className="font-extrabold text-neutral-900 dark:text-white whitespace-nowrap">
                        {h.name}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-neutral-800 dark:text-neutral-200">
                      <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
                        {h.departmentCode || 'CSE'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-neutral-600 dark:text-neutral-400">
                      {h.email}
                    </td>
                    <td className="py-4 px-6 font-semibold text-neutral-700 dark:text-neutral-300">
                      {h.academicYear}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          h.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-neutral-500">
                      {h.tenureStartDate ? new Date(h.tenureStartDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => navigate(`/dean/hods/${h.id}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-[11px] transition-all flex items-center space-x-1 cursor-pointer"
                          title="View HOD Details"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => navigate(`/dean/hods/assignments?hodUserId=${h.userId}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[11px] transition-all flex items-center space-x-1 cursor-pointer"
                          title="Assign Department"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Assign</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(h)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-bold text-[11px] transition-all flex items-center space-x-1 cursor-pointer"
                          title="Delete HOD"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-400">
                    No HOD records found for selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteModalOpen && selectedHodToDelete &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center flex-shrink-0 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Delete HOD Record
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Are you sure you want to permanently delete this Head of Department? This action will remove this record and associated data from the database.
                  </p>

                  <div className="mt-4 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400 font-medium">Name:</span>
                      <span className="font-bold text-neutral-900 dark:text-white">{selectedHodToDelete.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400 font-medium">Department:</span>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        {selectedHodToDelete.departmentCode ? `${selectedHodToDelete.departmentCode} - ${selectedHodToDelete.departmentName || ''}` : selectedHodToDelete.departmentName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400 font-medium">Email:</span>
                      <span className="font-medium text-neutral-600 dark:text-neutral-400 truncate max-w-[200px]">{selectedHodToDelete.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setSelectedHodToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Delete</span>
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

export default HodListPage;
