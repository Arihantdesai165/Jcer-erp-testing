import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Eye,
  Layers,
  RefreshCw,
  BookOpen,
  Filter,
  Shield,
  Building2,
} from 'lucide-react';
import hodService, { HodFacultyItem } from '../../services/hod.service';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';

export const HodFacultyListPage: React.FC = () => {
  const [faculty, setFaculty] = useState<HodFacultyItem[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [coreDeptFilter, setCoreDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [hodDeptCode, setHodDeptCode] = useState<string>('DEPT');

  useEffect(() => {
    loadDependencies();
    fetchFaculty();
  }, []);

  const loadDependencies = async () => {
    try {
      const depts = await hodService.getDepartments();
      if (depts) setDepartments(depts);
    } catch (e) {
      console.warn('Failed to load departments:', e);
    }
  };

  const fetchFaculty = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hodService.getFacultyList();
      setFaculty(data);
      if ((data as any).hodDepartment?.code) {
        setHodDeptCode((data as any).hodDepartment.code);
      }
    } catch (err: any) {
      console.error('Failed to load faculty:', err);
      setError('Unable to load global faculty directory.');
    } finally {
      setLoading(false);
    }
  };

  const filteredFaculty = faculty.filter((f) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      f.name.toLowerCase().includes(term) ||
      f.email.toLowerCase().includes(term) ||
      (f.designation && f.designation.toLowerCase().includes(term)) ||
      (f.coreDepartmentCode && f.coreDepartmentCode.toLowerCase().includes(term)) ||
      (f.coreDepartmentName && f.coreDepartmentName.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (coreDeptFilter !== 'ALL') {
      const deptMatch =
        f.coreDepartmentId === coreDeptFilter ||
        f.departmentId === coreDeptFilter ||
        f.coreDepartmentCode === coreDeptFilter;
      if (!deptMatch) return false;
    }

    if (statusFilter === 'ACTIVE') {
      return f.accountStatus === 'ACTIVE';
    } else if (statusFilter === 'INACTIVE') {
      return f.accountStatus !== 'ACTIVE';
    }
    return true;
  });

  const getAccountStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
        Inactive
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#070e22] text-white rounded-2xl px-5 py-3 shadow-sm border border-[#1e3a8a]/30">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
              Global Directory
            </span>
            <div className="text-2xl font-black mt-0.5">
              {faculty.length} <span className="text-xs font-semibold text-neutral-400">faculty</span>
            </div>
          </div>

         
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchFaculty()}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/hod/faculty/assignments"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all hover:opacity-90 border border-[#1e3a8a]/40"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-300" />
            <span>Teaching Allocation</span>
          </Link>
        </div>
      </div>

      {/* ── Search & Filter Bar ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search faculty by name, email, or designation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#0c1a40]"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Core Department Filter */}
          <select
            value={coreDeptFilter}
            onChange={(e) => setCoreDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Core Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 text-[11px] font-bold">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === filter
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-black'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Faculty Table ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">SL NO</th>
                <th className="py-3.5 px-4 text-left">Faculty Member</th>
                <th className="py-3.5 px-4">Core Department</th>
                <th className="py-3.5 px-4">Designation</th>
                <th className="py-3.5 px-4 text-center">Assigned in {hodDeptCode}</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0c1a40] border-t-transparent" />
                    <p className="mt-2 text-xs font-bold">Loading global faculty directory...</p>
                  </td>
                </tr>
              ) : filteredFaculty.length > 0 ? (
                filteredFaculty.map((member, idx) => {
                  const subjectsCount =
                    member.assignedSubjectsCount ??
                    member.hodAssignments?.length ??
                    member.assignments?.length ??
                    0;

                  return (
                    <tr key={member.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors">
                      {/* Sl. No */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-neutral-500 dark:text-neutral-400">
                        {idx + 1}
                      </td>

                      {/* Faculty Name */}
                      <td className="py-3.5 px-4 text-left">
                        <div>
                          <div className="font-bold text-neutral-900 dark:text-white whitespace-nowrap">
                            {member.name}
                          </div>
                          <div className="text-[10px] text-neutral-400 whitespace-nowrap">
                            {member.email || member.phone || ''}
                          </div>
                        </div>
                      </td>

                      {/* Core Department */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-neutral-900 dark:text-white block">
                          {member.coreDepartmentName || member.departmentName || 'Academic Department'}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          ({member.coreDepartmentCode || member.departmentCode || 'DEPT'})
                        </span>
                      </td>

                      {/* Designation */}
                      <td className="py-3.5 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                        {member.designation || 'Faculty'}
                      </td>

                      {/* Teaching Subjects in HOD's Department */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-black ${
                            subjectsCount > 0
                              ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          {subjectsCount} Subject{subjectsCount === 1 ? '' : 's'}
                        </span>
                      </td>

                      {/* Account Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {getAccountStatusBadge(member.accountStatus)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                          <Link
                            to={`/hod/faculty/${member.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-900 hover:text-white dark:bg-neutral-800 dark:hover:bg-neutral-100 dark:hover:text-neutral-900 text-neutral-800 dark:text-neutral-200 font-bold text-[11px] transition-all"
                            title="View Faculty Profile & Assignments"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </Link>

                          <Link
                            to={`/hod/faculty/assignments?facultyId=${member.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-[#0c1a40] hover:text-white dark:bg-blue-950/60 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200/60 dark:border-blue-800/60 transition-all"
                            title="Allocate Subjects to Faculty"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Allocate</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">No Faculty Found in Directory</p>
                    <p className="text-xs text-neutral-400 mt-1">Faculty records are centrally registered by the Dean Academics.</p>
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

export default HodFacultyListPage;
