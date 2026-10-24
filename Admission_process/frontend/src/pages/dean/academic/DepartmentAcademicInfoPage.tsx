import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Users,
  BookOpen,
  UserCheck,
  Grid,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import deanService from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const DepartmentAcademicInfoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'faculty' | 'subjects' | 'semesters'>('overview');

  useEffect(() => {
    if (!id) return;
    const fetchInfo = async () => {
      try {
        setLoading(true);
        const res = await deanService.getDepartmentAcademicInfo(id);
        setData(res);
      } catch (err: any) {
        toast.error('Failed to load department academic details');
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-neutral-400 space-y-4">
        <p className="text-sm font-semibold">Department information not found.</p>
        <button
          onClick={() => navigate('/dean/academic/departments')}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs"
        >
          Back to Departments
        </button>
      </div>
    );
  }

  const { department, academicYear, hod, stats, facultyList, subjectsList, semesterStructure } = data;

  return (
    <div className="space-y-6">

      {/* ── BACK BUTTON & BANNER ── */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => navigate('/dean/academic/departments')}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Departments</span>
        </button>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white border border-[#1e3a8a]/40 shadow-[0_16px_36px_rgba(7,14,34,0.35)] relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 rounded-full bg-gradient-to-br from-cyan-400/20 via-blue-500/15 to-transparent blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-semibold text-cyan-300">
            <Building2 className="w-3.5 h-3.5" />
            <span>Department Academic Details • AY {academicYear}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {department.name} ({department.code})
          </h1>
          <p className="text-blue-100/90 text-xs sm:text-sm font-medium">
            Academic infrastructure, appointed HOD, faculty allocation, curriculum, and semester section hierarchy.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <button
            onClick={() => navigate(`/dean/hods/assignments?dept=${department.id}`)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center space-x-1.5 border border-blue-400/30"
          >
            <UserCheck className="w-4 h-4 text-white" />
            <span>{hod ? 'Reassign HOD' : 'Assign HOD'}</span>
          </button>
        </div>
      </div>

      {/* ── SUMMARY STATS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* Card 1: HOD */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Current HOD</span>
          <p className="text-sm font-extrabold text-neutral-900 dark:text-white mt-1 truncate">
            {hod ? hod.name : 'Not Appointed'}
          </p>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block mt-0.5 truncate">
            {hod ? hod.email : 'Action needed'}
          </span>
        </div>

        {/* Card 2: Faculty */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Total Faculty</span>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1">{stats.facultyTotal}</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
            {stats.facultyActive} Active ({stats.facultyPending} Pending)
          </span>
        </div>

        {/* Card 3: Subjects */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Subjects</span>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1">{stats.subjectsTotal}</p>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold block mt-0.5">
            {stats.subjectsTheory} Theory • {stats.subjectsPractical} Lab
          </span>
        </div>

        {/* Card 4: Students */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Students</span>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1">{stats.studentsTotal}</p>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold block mt-0.5">
            Enrolled Candidates
          </span>
        </div>

        {/* Card 5: Sections */}
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Active Sections</span>
          <p className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1">{stats.activeSectionsCount}</p>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold block mt-0.5">
            Class Divisions
          </span>
        </div>

      </div>

      {/* ── TABS NAVIGATION ── */}
      <div className="flex items-center space-x-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          HOD & Department Overview
        </button>
        <button
          onClick={() => setActiveTab('faculty')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'faculty'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Faculty Roster ({facultyList.length})
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'subjects'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Curriculum Subjects ({subjectsList.length})
        </button>
        <button
          onClick={() => setActiveTab('semesters')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'semesters'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Semester & Section Structure
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* HOD Detailed Profile */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-amber-600" />
              <span>Department Head (HOD) Profile</span>
            </h3>

            {hod ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-4">
                  <ProfileAvatar
                    imageUrl={hod.profileImage}
                    name={hod.name}
                    size="lg"
                    roundedClassName="rounded-2xl"
                    className="w-14 h-14 shadow-md shrink-0"
                  />
                  <div>
                    <h4 className="text-base font-extrabold text-neutral-900 dark:text-white">{hod.name}</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{hod.email}</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Active Tenure
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-neutral-100 dark:border-neutral-800">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">Contact Phone</span>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">{hod.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">Tenure Start Date</span>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {hod.tenureStartDate ? new Date(hod.tenureStartDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">Appointment Order</span>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">{hod.appointmentOrderNo || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-neutral-400 space-y-3">
                <p className="text-xs font-semibold">No HOD assigned to this department yet.</p>
                <button
                  onClick={() => navigate(`/dean/hods/assignments?dept=${department.id}`)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                >
                  Assign Department HOD
                </button>
              </div>
            )}
          </div>

          {/* Academic Structure Summary */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Curriculum & Semester Hierarchy</span>
            </h3>

            <div className="space-y-2.5 pt-2">
              {semesterStructure.slice(0, 4).map((sem: any) => (
                <div
                  key={sem.semesterNumber}
                  className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-xs text-neutral-900 dark:text-white">{sem.semesterName}</span>
                    <p className="text-[10px] text-neutral-400">
                      {sem.subjectsCount} Subjects mapped • {sem.sectionsCount} Sections
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('semesters')}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center"
                  >
                    Details <ChevronRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── TAB: FACULTY ROSTER ── */}
      {activeTab === 'faculty' && (
        <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
          <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">Department Faculty Members</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Active teaching faculty assigned to {department.name}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
                <tr>
                  <th className="py-3.5 px-6 font-bold text-white">Faculty Name</th>
                  <th className="py-3.5 px-6 font-bold text-white">Email</th>
                  <th className="py-3.5 px-6 font-bold text-white">Designation</th>
                  <th className="py-3.5 px-6 font-bold text-white">Joining Date</th>
                  <th className="py-3.5 px-6 font-bold text-white text-center">Account Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {facultyList.length ? (
                  facultyList.map((fac: any) => (
                    <tr key={fac.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30">
                      <td className="py-4 px-6 font-bold text-neutral-900 dark:text-white">{fac.name}</td>
                      <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400 font-medium">{fac.email}</td>
                      <td className="py-4 px-6 font-semibold text-neutral-700 dark:text-neutral-300">{fac.designation}</td>
                      <td className="py-4 px-6 text-neutral-500">
                        {fac.joiningDate ? new Date(fac.joiningDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {fac.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400">
                      No faculty registered in this department yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: SUBJECTS CURRICULUM ── */}
      {activeTab === 'subjects' && (
        <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
          <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">Department Subjects Curriculum</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Semester-wise theoretical and practical subjects.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
                <tr>
                  <th className="py-3.5 px-6 font-bold text-white">Subject Code</th>
                  <th className="py-3.5 px-6 font-bold text-white">Subject Name</th>
                  <th className="py-3.5 px-6 font-bold text-white text-center">Semester</th>
                  <th className="py-3.5 px-6 font-bold text-white text-center">Credits</th>
                  <th className="py-3.5 px-6 font-bold text-white text-center">Type</th>
                  <th className="py-3.5 px-6 font-bold text-white text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {subjectsList.length ? (
                  subjectsList.map((sub: any) => (
                    <tr key={sub.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30">
                      <td className="py-4 px-6 font-extrabold text-neutral-900 dark:text-white">{sub.code}</td>
                      <td className="py-4 px-6 font-semibold text-neutral-800 dark:text-neutral-200">{sub.name}</td>
                      <td className="py-4 px-6 text-center font-bold text-neutral-700 dark:text-neutral-300">
                        Sem {sub.semester}
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-neutral-700 dark:text-neutral-300">
                        {sub.credits}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {sub.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {sub.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-400">
                      No subjects configured for this department yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: SEMESTER STRUCTURE ── */}
      {activeTab === 'semesters' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {semesterStructure.map((sem: any) => (
            <div
              key={sem.semesterNumber}
              className="p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                <h4 className="font-extrabold text-sm text-neutral-900 dark:text-white">{sem.semesterName}</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  {sem.sectionsCount} Sections
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Active Sections
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {sem.sections.length ? (
                    sem.sections.map((sec: any) => (
                      <span
                        key={sec.id}
                        className="px-2 py-1 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                      >
                        {sec.name} ({sec.capacity})
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-neutral-400">No sections created</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Subjects ({sem.subjectsCount})
                </span>
                <div className="space-y-1">
                  {sem.subjects.slice(0, 3).map((s: any) => (
                    <div key={s.id} className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 truncate">
                      • {s.code} - {s.name}
                    </div>
                  ))}
                  {sem.subjects.length > 3 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block pt-0.5">
                      +{sem.subjects.length - 3} more subjects
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default DepartmentAcademicInfoPage;
