import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Building2,
  Calendar,
  History,
  Mail,
  Phone,
  UserCheck,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import deanService from '../../../services/dean.service';
import Skeleton from '../../../components/common/Skeleton';
import { toast } from 'react-toastify';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

export const HodDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const fetchHod = async () => {
      try {
        setLoading(true);
        const res = await deanService.getHodById(id);
        setData(res);
      } catch (err) {
        toast.error('Failed to load HOD details');
      } finally {
        setLoading(false);
      }
    };
    fetchHod();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!data || !data.hod) {
    return (
      <div className="p-12 text-center text-neutral-400 space-y-4">
        <p className="text-sm font-semibold">HOD record not found.</p>
        <button
          onClick={() => navigate('/dean/hods')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs"
        >
          Back to HOD List
        </button>
      </div>
    );
  }

  const { hod, history } = data;
  const user = hod.user;

  return (
    <div className="space-y-6">

      {/* ── BACK BUTTON ── */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => {
            if (window.history.length > 2) {
              navigate(-1);
            } else {
              navigate('/dean/hods');
            }
          }}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* ── PROFILE HEADER ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <ProfileAvatar
            imageUrl={user?.profileImage}
            name={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'HOD'}
            size="2xl"
            roundedClassName="rounded-3xl"
            className="w-20 h-20 shadow-md shrink-0"
          />

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                {user?.firstName} {user?.lastName}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  hod.isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {hod.isActive ? 'Active Tenure' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Department: <span className="font-bold text-neutral-800 dark:text-neutral-200">{hod.department?.name} ({hod.department?.code})</span>
            </p>
            <p className="text-xs text-neutral-400">Appointment Order: {hod.appointmentOrderNo || 'N/A'}</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/dean/hods/assignments?hodUserId=${hod.userId}`)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 border border-blue-400/30 flex items-center space-x-1.5 self-start md:self-center cursor-pointer"
        >
          <UserCheck className="w-4 h-4 text-white" />
          <span>Reassign Department</span>
        </button>
      </div>

      {/* ── DETAILS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Personal & Account Info */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <User className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
            <span>Personal & Account Details</span>
          </h3>

          <div className="space-y-3 text-xs divide-y divide-neutral-100 dark:divide-neutral-800">
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Official Email</span>
              <span className="font-bold text-neutral-900 dark:text-white">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Phone Number</span>
              <span className="font-bold text-neutral-900 dark:text-white">{user?.phone || 'Not provided'}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Account Role</span>
              <span className="font-bold text-blue-600 dark:text-cyan-400">HEAD_OF_DEPARTMENT (HOD)</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Account Status</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{user?.status || 'ACTIVE'}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Profile Created</span>
              <span className="font-semibold text-neutral-600 dark:text-neutral-400">
                {new Date(hod.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Current Department Tenure */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Current Assignment Details</span>
          </h3>

          <div className="space-y-3 text-xs divide-y divide-neutral-100 dark:divide-neutral-800">
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Department</span>
              <span className="font-bold text-neutral-900 dark:text-white">{hod.department?.name}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Department Code</span>
              <span className="font-bold text-neutral-900 dark:text-white">{hod.department?.code}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Tenure Start Date</span>
              <span className="font-bold text-neutral-900 dark:text-white">
                {hod.tenureStartDate ? new Date(hod.tenureStartDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-neutral-400">Appointment Order</span>
              <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{hod.appointmentOrderNo || 'N/A'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── ASSIGNMENT HISTORY TABLE ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <History className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
            <span>Department Assignment History</span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Historical record of departmental appointments and tenures for this faculty member.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
              <tr>
                <th className="py-3.5 px-6 font-bold text-white">Department</th>
                <th className="py-3.5 px-6 font-bold text-white">Academic Year</th>
                <th className="py-3.5 px-6 font-bold text-white">Start Date</th>
                <th className="py-3.5 px-6 font-bold text-white">End Date</th>
                <th className="py-3.5 px-6 font-bold text-white text-center">Status</th>
                <th className="py-3.5 px-6 font-bold text-white">Appointed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {history && history.length ? (
                history.map((hItem: any) => (
                  <tr key={hItem.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30">
                    <td className="py-4 px-6 font-bold text-neutral-900 dark:text-white">
                      {hItem.department?.name} ({hItem.department?.code})
                    </td>
                    <td className="py-4 px-6 font-semibold text-neutral-800 dark:text-neutral-200">
                      {hItem.academicYear}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400">
                      {new Date(hItem.startDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400">
                      {hItem.endDate ? new Date(hItem.endDate).toLocaleDateString() : 'Current'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          hItem.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {hItem.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-neutral-500">
                      {hItem.assignedBy ? `${hItem.assignedBy.firstName} ${hItem.assignedBy.lastName}` : 'Dean Academics'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400">
                    No historical assignments recorded yet.
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

export default HodDetailPage;
