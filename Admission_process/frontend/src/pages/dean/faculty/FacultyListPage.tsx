import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  FileCheck2,
  Eye,
  AlertCircle,
  Archive,
  RefreshCw
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

  const fetchDependencies = async () => {
    try {
      const depts = await deanService.getDepartments();
      setDepartments(depts);
    } catch (err: any) {
      console.warn('Failed to load departments:', err);
    }
  };

  const fetchFaculty = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await deanService.getFacultyList({
        search: search.trim() || undefined,
        departmentId: selectedDept,
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
  }, [selectedDept, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFaculty();
  };

  return (
    <div className="space-y-6">

      {/* ── TOP FILTERS & QUICK ACTIONS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search faculty by name, email, or designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive / Pending</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <button
            type="submit"
            className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => navigate('/dean/faculty/create')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Create Faculty</span>
          </button>
          <button
            onClick={() => navigate('/dean/faculty/bulk-import')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Bulk Import</span>
          </button>
          <button
            onClick={() => navigate('/dean/faculty/archived')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
          >
            <Archive className="w-4 h-4" />
            <span>Archived Faculty</span>
          </button>
          <button
            onClick={() => navigate('/dean/faculty/assignments')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold transition-all cursor-pointer"
          >
            <span>Assignments View</span>
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
            Total Active Faculty: {faculty.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-4 font-bold text-white text-center w-16">SL NO</th>
                <th className="py-3.5 px-6 font-bold text-white">Faculty Name</th>
                <th className="py-3.5 px-6 font-bold text-white">Department</th>
                <th className="py-3.5 px-6 font-bold text-white">Official Email</th>
                <th className="py-3.5 px-6 font-bold text-white">Designation</th>
                <th className="py-3.5 px-6 font-bold text-white">Assigned Subjects</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Status</th>
                <th className="py-3.5 px-6 font-bold text-white">Joining Date</th>
                <th className="py-3.5 px-6 font-bold text-white text-right">Actions</th>
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
              ) : faculty.length ? (
                faculty.map((fac, idx) => (
                  <tr key={fac.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-4 px-4 text-center font-bold text-neutral-500 dark:text-neutral-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-6">
                      <div
                        onClick={() => navigate(`/dean/faculty/${fac.id}`)}
                        className="flex items-center space-x-3 cursor-pointer group"
                      >
                        <ProfileAvatar
                          imageUrl={fac.profileImage}
                          name={fac.name}
                          size="sm"
                          className="group-hover:ring-2 group-hover:ring-indigo-500 transition-all shrink-0"
                        />
                        <div>
                          <span className="font-extrabold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block">
                            {fac.name}
                          </span>
                          <span className="text-[10px] text-neutral-400">{fac.phone || 'Phone not set'}</span>
                        </div>
                      </div>
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
                          onClick={() => navigate(`/dean/faculty/${fac.id}/archive`)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition-all border border-rose-200/60 dark:border-rose-900/40 cursor-pointer"
                          title="Archive Faculty Member"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive</span>
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
                        onClick={fetchFaculty}
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
                    No active faculty records found.
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

export default FacultyListPage;
