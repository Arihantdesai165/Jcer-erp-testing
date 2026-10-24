import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Calendar,
  BookOpen,
  Mail,
  Phone,
  Building2,
  Layers,
  Shield,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import hodService from '../../services/hod.service';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';

export const HodFacultyManagePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchFacultyDetails(id);
    }
  }, [id]);

  const fetchFacultyDetails = async (facultyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await hodService.getFacultyDetail(facultyId);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load faculty details:', err);
      setError('Unable to load faculty member details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-neutral-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#0c1a40] border-t-transparent" />
        <p className="mt-3 text-xs font-bold text-neutral-600 dark:text-neutral-400">Loading faculty profile...</p>
      </div>
    );
  }

  if (error || !data || !data.teacher) {
    return (
      <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-4">
        <Users className="w-10 h-10 mx-auto text-neutral-400" />
        <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">{error || 'Faculty member not found'}</h3>
        <Link
          to="/hod/faculty"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Global Directory</span>
        </Link>
      </div>
    );
  }

  const { teacher, hodDepartment, teachingAssignments = [] } = data;
  const isAccountActive = teacher.accountStatus === 'ACTIVE';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Back Button ── */}
      <div className="flex items-center justify-between">
        <Link
          to="/hod/faculty"
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
          <span>Back to Faculty Directory</span>
        </Link>
      </div>

      {/* ── 1. Profile Header Card ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <ProfileAvatar
              imageUrl={teacher.profileImage}
              name={teacher.name}
              size="xl"
              roundedClassName="rounded-2xl"
              className="w-16 h-16 shadow-md border border-[#1e3a8a]/40 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
                  {teacher.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {isAccountActive ? 'Active Faculty' : teacher.accountStatus || 'Active'}
                </span>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">{teacher.designation || 'Faculty'}</span>
                <span>•</span>
                <span className="font-mono">{teacher.email}</span>
                <span>•</span>
                <span>{teacher.phone || 'No phone provided'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              to={`/hod/faculty/assignments?facultyId=${teacher.id}`}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition-all hover:opacity-95 border border-[#1e3a8a]/40"
            >
              <BookOpen className="w-4 h-4 text-cyan-300" />
              <span>Allocate Teaching Assignment</span>
            </Link>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60">
            <span className="text-neutral-400 font-medium block text-[10px] uppercase tracking-wider">Core Department</span>
            <span className="font-bold text-neutral-900 dark:text-white text-xs mt-0.5 block">
              {teacher.coreDepartmentName || teacher.department || 'Academic Department'} ({teacher.coreDepartmentCode || teacher.departmentCode || 'DEPT'})
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60">
            <span className="text-neutral-400 font-medium block text-[10px] uppercase tracking-wider">Academic Designation</span>
            <span className="font-bold text-neutral-900 dark:text-white text-xs mt-0.5 block">
              {teacher.designation || 'Assistant Professor'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60">
            <span className="text-neutral-400 font-medium block text-[10px] uppercase tracking-wider">Joining Date</span>
            <span className="font-bold text-neutral-900 dark:text-white text-xs mt-0.5 block">
              {teacher.joiningDate ? new Date(teacher.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60">
            <span className="text-neutral-400 font-medium block text-[10px] uppercase tracking-wider">Directory Status</span>
            <span className="font-bold text-neutral-900 dark:text-white text-xs mt-0.5 block">
              Global Directory (Active)
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Current Teaching Assignments in HOD's Department ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
              Teaching Assignments in {hodDepartment?.code || 'Department'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Subjects and sections allocated to this faculty member for the current academic year.
            </p>
          </div>

          <Link
            to={`/hod/faculty/assignments?facultyId=${teacher.id}`}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Manage Allocations</span>
          </Link>
        </div>

        {teachingAssignments && teachingAssignments.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Semester</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4">Academic Year</th>
                  <th className="py-3 px-4">Access Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {teachingAssignments.map((asg: any) => (
                  <tr key={asg.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                    <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                      {asg.subjectName || asg.subjectCode} <span className="font-mono text-neutral-400 font-normal">({asg.subjectCode})</span>
                    </td>
                    <td className="py-3 px-4 font-bold">Semester {asg.semester}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 font-bold">
                        Section {asg.section}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-500">{asg.academicYear}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Attendance & Marks Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No active teaching assignments in this department</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Use Teaching Allocation to assign subjects and sections to this faculty member.</p>
            <Link
              to={`/hod/faculty/assignments?facultyId=${teacher.id}`}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              <span>Allocate Subject Now</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodFacultyManagePage;
