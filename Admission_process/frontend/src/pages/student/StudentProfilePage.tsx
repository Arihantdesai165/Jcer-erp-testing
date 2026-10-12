import React, { useState, useEffect } from 'react';
import studentService, { StudentProfileData } from '../../services/student.service';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Users,
  GraduationCap,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Hash,
} from 'lucide-react';

export const StudentProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await studentService.getProfile();
      setProfile(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load student profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="h-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl animate-pulse" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
        <div className="size-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-neutral-900 dark:text-white text-base">Unable to Load Profile</h3>
        <p className="text-xs text-neutral-500">{error || 'Admission profile information could not be retrieved.'}</p>
        <button
          onClick={fetchProfile}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { student, academic, admission, contact, address, parent } = profile;

  // Helper field row renderer (Read-Only display item)
  const InfoField: React.FC<{ label: string; value?: string | number | null; mono?: boolean }> = ({
    label,
    value,
    mono,
  }) => (
    <div className="space-y-1">
      <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
        {label}
      </span>
      <span
        className={`text-xs font-bold text-neutral-900 dark:text-white block truncate ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value !== null && value !== undefined && String(value).trim() !== '' ? String(value) : '—'}
      </span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── PROFILE HEADER HERO CARD ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center gap-6">
        <ProfileAvatar
          name={student.name}
          size="xl"
          className="border-4 border-indigo-100 dark:border-indigo-950 shadow-md flex-shrink-0"
        />
        <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
              {student.name}
            </h2>
            <span className="px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-mono font-bold self-center sm:self-auto">
              USN: {student.usn}
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-medium">
            {academic.departmentName} ({academic.departmentCode}) • {academic.program || 'Bachelor of Engineering'}
          </p>
          <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-[11px] text-neutral-500 flex-wrap">
            <span className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-md font-semibold">
              Semester {academic.currentSemester}
            </span>
            {academic.section && (
              <span className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-md font-semibold">
                Section: {academic.section}
              </span>
            )}
            <span className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-md font-semibold">
              Academic Year: {academic.academicYear}
            </span>
          </div>
        </div>

        {/* Read-Only Status Badge */}
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified Official Record (Read-Only)</span>
          </span>
        </div>
      </div>

      {/* ── SECTION 1: PERSONAL INFORMATION ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <User className="w-4 h-4 text-indigo-600" />
          <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">
            Personal Information
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          <InfoField label="Full Legal Name" value={student.name} />
          <InfoField label="Gender" value={student.gender} />
          <InfoField label="Date of Birth" value={student.dob ? new Date(student.dob).toLocaleDateString() : '—'} />
          <InfoField label="Blood Group" value={student.bloodGroup} />
          <InfoField label="Category / Reservation" value={student.category} />
          <InfoField label="Caste" value={student.caste} />
          <InfoField label="Religion" value={student.religion} />
          <InfoField label="Nationality" value={student.nationality || 'Indian'} />
          <InfoField label="Aadhaar Identifier" value={student.aadhaarNumberMasked} mono />
        </div>
      </div>

      {/* ── SECTION 2: ADMISSION & ACADEMIC DETAILS ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <GraduationCap className="w-4 h-4 text-cyan-600" />
          <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">
            Admission & Academic Information
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          <InfoField label="Application No." value={admission?.applicationNumber} mono />
          <InfoField label="University Seat No (USN)" value={student.usn} mono />
          <InfoField label="Department Code" value={academic.departmentCode} />
          <InfoField label="Department Name" value={academic.departmentName} />
          <InfoField label="Degree Program" value={academic.program} />
          <InfoField label="Current Semester" value={academic.currentSemester} />
          <InfoField label="Allocated Section" value={academic.section} />
          <InfoField label="Academic Year" value={academic.academicYear} />
          <InfoField label="Admission Quota" value={admission?.quota} />
          <InfoField label="Admission Type" value={admission?.admissionType} />
          <InfoField label="Enrolled On" value={admission?.enrolledAt ? new Date(admission.enrolledAt).toLocaleDateString() : '—'} />
          <InfoField label="Previous Board / Institution" value={academic.previousBoard || academic.previousSchool} />
          <InfoField label="Entrance Exam Rank / Score" value={academic.rank} />
          <InfoField label="Qualifying Percentage" value={academic.previousPercentage ? `${academic.previousPercentage}%` : '—'} />
        </div>
      </div>

      {/* ── SECTION 3: CONTACT INFORMATION ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <Phone className="w-4 h-4 text-emerald-600" />
          <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">
            Contact Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <InfoField label="Primary Mobile" value={contact.studentMobile || student.phone} mono />
          <InfoField label="Official Student Email" value={contact.studentEmail || student.email} />
          <InfoField label="Emergency Contact Number" value={contact.emergencyContact} mono />
        </div>
      </div>

      {/* ── SECTION 4: ADDRESS INFORMATION ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <MapPin className="w-4 h-4 text-amber-600" />
          <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">
            Address Information
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Permanent Address */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200/60 dark:border-neutral-800 space-y-2">
            <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block">
              Permanent Address
            </span>
            <div className="text-xs space-y-1 text-neutral-800 dark:text-neutral-200 font-semibold leading-relaxed">
              <p>{address.permanent.line1 || '—'}</p>
              {address.permanent.line2 && <p>{address.permanent.line2}</p>}
              <p>
                {address.permanent.city ? `${address.permanent.city}, ` : ''}
                {address.permanent.district ? `${address.permanent.district}, ` : ''}
                {address.permanent.state || ''}
              </p>
              <p className="font-mono text-neutral-500">
                Pincode: {address.permanent.pincode || '—'}
              </p>
            </div>
          </div>

          {/* Correspondence Address */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200/60 dark:border-neutral-800 space-y-2">
            <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider block">
              Correspondence / Current Address
            </span>
            <div className="text-xs space-y-1 text-neutral-800 dark:text-neutral-200 font-semibold leading-relaxed">
              <p>{address.correspondence.line1 || address.permanent.line1 || '—'}</p>
              {address.correspondence.line2 && <p>{address.correspondence.line2}</p>}
              <p>
                {address.correspondence.city || address.permanent.city ? `${address.correspondence.city || address.permanent.city}, ` : ''}
                {address.correspondence.district || address.permanent.district ? `${address.correspondence.district || address.permanent.district}, ` : ''}
                {address.correspondence.state || address.permanent.state || ''}
              </p>
              <p className="font-mono text-neutral-500">
                Pincode: {address.correspondence.pincode || address.permanent.pincode || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: PARENT / GUARDIAN INFORMATION ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <Users className="w-4 h-4 text-purple-600" />
          <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">
            Parent & Guardian Information
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          <InfoField label="Father's Full Name" value={parent.fatherName} />
          <InfoField label="Father's Occupation" value={parent.fatherOccupation} />
          <InfoField label="Father's Mobile Number" value={parent.fatherPhone} mono />
          <InfoField label="Father's Email" value={parent.fatherEmail} />

          <InfoField label="Mother's Full Name" value={parent.motherName} />
          <InfoField label="Mother's Occupation" value={parent.motherOccupation} />
          <InfoField label="Mother's Mobile Number" value={parent.motherPhone} mono />
          <InfoField label="Mother's Email" value={parent.motherEmail} />

          {parent.guardianName && (
            <>
              <InfoField label="Guardian Name" value={parent.guardianName} />
              <InfoField label="Guardian Mobile" value={parent.guardianPhone} mono />
            </>
          )}

          <InfoField label="Annual Family Income" value={parent.annualIncome} />
        </div>
      </div>
    </div>
  );
};

export default StudentProfilePage;
