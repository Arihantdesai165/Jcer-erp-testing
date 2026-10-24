import React, { useState, useEffect } from 'react';
import { Search, FileCheck2, Filter, Building2, BookOpen } from 'lucide-react';
import deanService, { FacultyAssignmentRecord, DepartmentRecord, AcademicYearRecord } from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const FacultyAssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<FacultyAssignmentRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedSem, setSelectedSem] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('2026-27');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const fetchDependencies = async () => {
    try {
      const [depts, yrs] = await Promise.all([
        deanService.getDepartments(),
        deanService.getAcademicYears(),
      ]);
      setDepartments(depts);
      setAcademicYears(yrs);
      const activeYr = yrs.find((y) => y.isCurrent)?.year || '2026-27';
      setSelectedYear(activeYr);
    } catch (err) {
      toast.error('Failed to load filter options');
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await deanService.getFacultyAssignments({
        search: search || undefined,
        departmentId: selectedDept,
        semester: selectedSem !== 'ALL' ? Number(selectedSem) : undefined,
        academicYear: selectedYear,
        status: selectedStatus,
      });
      setAssignments(data);
    } catch (err) {
      toast.error('Failed to load faculty assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [selectedDept, selectedSem, selectedYear, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAssignments();
  };

  return (
    <div className="space-y-6">

      {/* ── TOP FILTERS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search faculty name or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
            value={selectedSem}
            onChange={(e) => setSelectedSem(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none"
          >
            <option value="ALL">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Sem {s}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 focus:outline-none"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.year}>
                {y.year}
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
            <option value="INACTIVE">Inactive</option>
          </select>

          <button
            type="submit"
            className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
          >
            Filter
          </button>
        </form>
      </div>

      {/* ── TABLE CARD ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Academic Faculty Teaching Assignments</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Mapping of teaching faculty to specific department subjects, semester terms, and academic sessions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-6 font-bold text-white text-left">Faculty Member</th>
                <th className="py-3.5 px-6 font-bold text-white">Department</th>
                <th className="py-3.5 px-6 font-bold text-white">Subject Code</th>
                <th className="py-3.5 px-6 font-bold text-white">Teaching Subject</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Semester</th>
                <th className="py-3.5 px-6 font-bold text-white">Academic Year</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="py-4 px-6"><Skeleton className="w-32 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-36 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-8 h-4 mx-auto" /></td>
                    <td className="py-4 px-6"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-6 text-center"><Skeleton className="w-14 h-4 mx-auto" /></td>
                  </tr>
                ))
              ) : assignments.length ? (
                assignments.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-4 px-6 text-left">
                      <div>
                        <span className="font-extrabold text-neutral-900 dark:text-white block whitespace-nowrap">{item.facultyName}</span>
                        <span className="text-[10px] text-neutral-400 block whitespace-nowrap">{item.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-neutral-800 dark:text-neutral-200">
                      <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
                        {item.departmentCode}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-neutral-700 dark:text-neutral-300">
                      {item.subjectCode}
                    </td>
                    <td className="py-4 px-6 font-semibold text-neutral-800 dark:text-neutral-200">
                      {item.subjectName}
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-neutral-700 dark:text-neutral-300">
                      Sem {item.semester}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400 font-medium">
                      {item.academicYear}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    No faculty assignments found for selected filters.
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

export default FacultyAssignmentsPage;
