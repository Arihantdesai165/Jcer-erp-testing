import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, UserCheck, Edit3, Eye, X, AlertCircle, SlidersHorizontal, Filter, RotateCcw } from 'lucide-react';
import deanService, { DepartmentRecord } from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';

export const DepartmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [hodFilter, setHodFilter] = useState<string>('ALL');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const data = await deanService.getDepartments({ search: search || undefined });
      setDepartments(data);
    } catch (err) {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDepartments();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setHodFilter('ALL');
  };

  // Client-side instant filtering across loaded departments
  const filteredDepartments = departments.filter((dept) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchesName = dept.name?.toLowerCase().includes(q);
      const matchesCode = dept.code?.toLowerCase().includes(q);
      const matchesHod = dept.hod?.name?.toLowerCase().includes(q);
      if (!matchesName && !matchesCode && !matchesHod) return false;
    }
    const deptStatus = String(dept.status || '').toUpperCase();
    if (statusFilter !== 'ALL' && deptStatus !== statusFilter.toUpperCase()) {
      return false;
    }
    if (hodFilter === 'ASSIGNED' && !dept.hod) {
      return false;
    }
    if (hodFilter === 'UNASSIGNED' && dept.hod) {
      return false;
    }
    return true;
  });

  const totalCount = departments.length;
  const activeCount = departments.filter((d) => String(d.status || '').toUpperCase() === 'ACTIVE').length;
  const inactiveCount = departments.filter((d) => String(d.status || '').toUpperCase() === 'INACTIVE').length;
  const hodAssignedCount = departments.filter((d) => !!d.hod).length;
  const needsHodCount = departments.filter((d) => !d.hod).length;

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== 'ALL' || hodFilter !== 'ALL');
  const activeFiltersCount =
    (search.trim() ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (hodFilter !== 'ALL' ? 1 : 0);

  const openCreateModal = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setModalOpen(true);
  };

  const openEditModal = (dept: DepartmentRecord) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) {
      toast.error('Please enter department name and code');
      return;
    }

    try {
      setSaving(true);
      if (editingDept) {
        await deanService.updateDepartment(editingDept.id, { name, code });
        toast.success(`Department ${code} updated successfully.`);
      } else {
        await deanService.createDepartment({ name, code });
        toast.success(`Department ${code} created successfully.`);
      }
      setModalOpen(false);
      fetchDepartments();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── FILTERS PANEL (MATERIALISTIC DESIGN) ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
        {/* Search Row */}
        <div className="px-5 py-3.5 flex flex-wrap lg:flex-nowrap items-center gap-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex-1 min-w-[260px] flex items-center gap-2.5 px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
            <Search className="shrink-0 text-neutral-400" size={16} />
            <input
              type="text"
              placeholder="Search by department name, code (e.g. CSE), or HOD..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  fetchDepartments();
                }
              }}
              className="flex-1 bg-transparent text-sm text-neutral-800 dark:text-white placeholder:text-neutral-400 outline-none font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 transition-colors text-xs font-bold cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchDepartments()}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Search size={14} />
            Search
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </button>
        </div>

        {/* Filter Dropdowns & Inline Actions */}
        <div className="px-5 pt-4 pb-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            {/* Status */}
            <div className="space-y-1 w-full sm:w-64">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Department Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-[38px]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {/* HOD Leadership */}
            <div className="space-y-1 w-full sm:w-64">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                HOD Leadership
              </label>
              <select
                value={hodFilter}
                onChange={(e) => setHodFilter(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-[38px]"
              >
                <option value="ALL">All Leadership</option>
                <option value="ASSIGNED">HOD Appointed</option>
                <option value="UNASSIGNED">Unassigned (Action Needed)</option>
              </select>
            </div>

            {/* Reset & Apply in one line */}
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
                onClick={() => fetchDepartments()}
                className="h-[38px] flex items-center gap-1.5 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>

          {/* Active filter chips */}
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
                    onClick={() => setSearch('')}
                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  Status: {statusFilter === 'ACTIVE' ? 'Active' : 'Inactive'}
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {hodFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  HOD: {hodFilter === 'ASSIGNED' ? 'Appointed' : 'Unassigned'}
                  <button
                    type="button"
                    onClick={() => setHodFilter('ALL')}
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
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">All</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-neutral-900 border-neutral-950 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-[1.01]'
            }`}
          >
            <span className="w-full text-center leading-none">Active</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-4 py-2 rounded-xl border text-center transition-all duration-200 shrink-0 min-w-[85px] h-10 flex items-center justify-center text-xs font-black shadow-sm cursor-pointer ${
              statusFilter === 'INACTIVE'
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
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">College Departments Directory</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Overview of engineering disciplines, faculty strengths, appointed HODs, and student enrollments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              Showing {filteredDepartments.length} of {departments.length} departments
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-6 text-center w-36 font-bold text-white">Department Code</th>
                <th className="py-3.5 px-6 text-left font-bold text-white">Department Name</th>
                <th className="py-3.5 px-6 text-left font-bold text-white">Assigned HOD</th>
                <th className="py-3.5 px-6 text-center font-bold w-28 text-white">Faculty Count</th>
                <th className="py-3.5 px-6 text-center font-bold w-28 text-white">Student Count</th>
                <th className="py-3.5 px-6 text-center font-bold w-24 text-white">Status</th>
                <th className="py-3.5 px-6 text-center font-bold w-60 text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-16 h-4 mx-auto" /></td>
                    <td className="py-4 px-6 text-left"><Skeleton className="w-48 h-4" /></td>
                    <td className="py-4 px-6 text-left"><Skeleton className="w-28 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-8 h-4 mx-auto" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-8 h-4 mx-auto" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-12 h-4 mx-auto" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-32 h-4 mx-auto" /></td>
                  </tr>
                ))
              ) : filteredDepartments.length ? (
                filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-4 px-6 text-center font-bold text-neutral-900 dark:text-white">
                      {dept.code}
                    </td>
                    <td className="py-4 px-6 text-left font-semibold text-neutral-800 dark:text-neutral-200">
                      {dept.name}
                    </td>
                    <td className="py-4 px-6 text-left">
                      {dept.hod ? (
                        <span className="font-bold text-neutral-900 dark:text-white block">
                          {dept.hod.name}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-neutral-700 dark:text-neutral-300">
                      {dept.facultyCount}
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-neutral-700 dark:text-neutral-300">
                      {dept.studentCount}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {dept.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="inline-flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => navigate(`/dean/academic/departments/${dept.id}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[11px] transition-all flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => openEditModal(dept)}
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-[11px] transition-all flex items-center space-x-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => navigate(`/dean/hods/assignments?dept=${dept.id}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[11px] transition-all flex items-center space-x-1"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Assign HOD</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                        <Search className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No departments match your filters</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Try adjusting your search query, status, or leadership assignment filter.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs cursor-pointer"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {editingDept ? `Edit Department (${editingDept.code})` : 'Add Department'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science & Engineering"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Department Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CSE"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 uppercase"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingDept ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default DepartmentsPage;
