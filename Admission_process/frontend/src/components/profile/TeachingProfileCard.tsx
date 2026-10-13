import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { toast } from 'react-toastify';
import { GraduationCap, CheckCircle2, AlertCircle, BookOpen, Loader2, Sparkles, ShieldCheck, Lock } from 'lucide-react';
import deanService, { TeachingProfileData, DepartmentRecord } from '../../services/dean.service';
import principalService from '../../services/principal.service';
import facultyService from '../../services/faculty.service';
import API from '../../services/api';

interface TeachingProfileCardProps {
  role?: 'DEAN' | 'PRINCIPAL' | 'FACULTY' | 'HOD';
}

export const TeachingProfileCard: React.FC<TeachingProfileCardProps> = ({ role = 'FACULTY' }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [profile, setProfile] = useState<TeachingProfileData | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // If user is actually DEAN or PRINCIPAL in faculty workspace, they retain update permission
  const isAdministrativeRole = user?.role === 'DEAN' || user?.role === 'PRINCIPAL' || role === 'DEAN' || role === 'PRINCIPAL';
  const effectiveRole = user?.role === 'PRINCIPAL' || role === 'PRINCIPAL' ? 'PRINCIPAL' : (user?.role === 'DEAN' || role === 'DEAN' ? 'DEAN' : 'FACULTY');

  const fetchProfileAndDepts = async () => {
    try {
      setLoading(true);
      let profileData: TeachingProfileData | null = null;
      let deptsData: DepartmentRecord[] = [];

      if (effectiveRole === 'DEAN') {
        [profileData, deptsData] = await Promise.all([
          deanService.getTeachingProfile().catch(() => facultyService.getTeachingProfile()),
          deanService.getDepartments().catch(async () => {
            const b = await API.get('/branches');
            return b.data.data || [];
          }),
        ]);
      } else if (effectiveRole === 'PRINCIPAL') {
        [profileData, deptsData] = await Promise.all([
          principalService.getTeachingProfile().catch(() => facultyService.getTeachingProfile()),
          principalService.getDepartments().catch(async () => {
            const b = await API.get('/branches');
            return b.data.data || [];
          }),
        ]);
      } else {
        // Standard Faculty or HOD
        profileData = await facultyService.getTeachingProfile();
        try {
          const deptRes = await API.get('/branches');
          deptsData = deptRes.data.data || [];
        } catch {
          deptsData = [];
        }
      }

      setProfile(profileData);
      setDepartments(deptsData || []);
      if (profileData?.coreDepartmentId) {
        setSelectedDeptId(profileData.coreDepartmentId);
      }
    } catch (err: any) {
      console.error('Failed to load teaching profile data:', err);
      toast.error('Unable to load teaching profile information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndDepts();
  }, [role, user?.role]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdministrativeRole) {
      toast.info('Core department reassignment requires Dean / Administration approval.');
      return;
    }

    if (!selectedDeptId) {
      toast.error('Please select a Core Department.');
      return;
    }

    try {
      setSaving(true);
      const res = effectiveRole === 'PRINCIPAL'
        ? await principalService.updateTeachingProfile({ coreDepartmentId: selectedDeptId })
        : await deanService.updateTeachingProfile({ coreDepartmentId: selectedDeptId });

      toast.success(res?.message || 'Teaching profile updated successfully! You are now eligible for teaching assignments.');
      await fetchProfileAndDepts();
    } catch (err: any) {
      console.error('Failed to update teaching profile:', err);
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to update teaching profile.';
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const hasActiveAssignments = Boolean(profile?.activeAssignments && profile.activeAssignments.length > 0);

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xs flex items-center justify-center min-h-[220px]">
        <div className="flex items-center gap-2 text-xs text-neutral-400 font-bold">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Loading Teaching Profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
              <span>Teaching Profile & Academic Capabilities</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Select your official Core Department to receive teaching assignments from HODs and access the Faculty Dashboard.
            </p>
          </div>
        </div>

        {/* Eligibility Status Pill */}
        <div className="self-start sm:self-auto">
          {profile?.isTeachingEligible ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/50">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Teaching Eligible</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/50">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Not Configured</span>
            </span>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSaveProfile} className="space-y-5">
        <div>
          <label className="block text-[11px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Core Department <span className="text-rose-500">*</span>
          </label>
          <div className="relative max-w-xl">
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              disabled={!isAdministrativeRole || hasActiveAssignments || saving}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:border-emerald-500 text-neutral-900 dark:text-white font-bold text-xs disabled:opacity-75 disabled:cursor-not-allowed"
              required
            >
              <option value="">-- Select Your Core Teaching Department --</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.code} — {dept.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1.5">
            {!isAdministrativeRole ? (
              <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                Your official Core Department was established by Academic Administration ({profile?.coreDepartment?.code ? `${profile.coreDepartment.code} — ` : ''}{profile?.coreDepartment?.name || 'Assigned'}). Department reassignment requires Dean / Administrative authorization.
              </span>
            ) : hasActiveAssignments ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Core Department cannot be altered while active teaching allocations exist. Please complete or transfer assignments first.
              </span>
            ) : (
              'HODs in this department will see you in their faculty assignment dropdown and can allocate courses to you directly.'
            )}
          </p>
        </div>

        {/* Informative capability note */}
        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 flex items-start gap-3 text-xs max-w-2xl">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-neutral-600 dark:text-neutral-300">
            <p className="font-bold text-neutral-900 dark:text-white">
              Single Account, Multi-Capability Architecture
            </p>
            <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              {isAdministrativeRole
                ? `Your ${effectiveRole === 'DEAN' ? 'Dean Academic' : 'Principal'} administrative credentials, permissions, and security settings are fully preserved. Enabling a teaching profile adds access to the Faculty Dashboard without creating duplicate logins.`
                : 'Your faculty credentials, authorized course allocations, attendance registers, and bitwise marks entry are active and centrally linked to your authenticated account.'}
            </p>
          </div>
        </div>

        {/* Active Assignments Summary if any */}
        {profile?.activeAssignments && profile.activeAssignments.length > 0 && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Current Active Teaching Assignments ({profile.activeAssignments.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {profile.activeAssignments.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                      {a.subjectCode || 'CODE'}
                    </span>
                    <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                      Sem {a.semester} {a.section ? `• Sec ${a.section}` : ''}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-neutral-900 dark:text-white truncate" title={a.subjectName}>
                    {a.subjectName || 'Subject'}
                  </h4>
                  <div className="text-[10px] text-neutral-400 flex items-center justify-between">
                    <span>AY {a.academicYear}</span>
                    <span>Dept: {a.teachingDepartment?.code || 'DEPT'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button (Only for administrative roles that configure self-teaching department) */}
        {isAdministrativeRole && (
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || hasActiveAssignments || !selectedDeptId}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Teaching Profile...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{profile?.isTeachingEligible ? 'Update Teaching Profile' : 'Save & Enable Teaching'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default TeachingProfileCard;
