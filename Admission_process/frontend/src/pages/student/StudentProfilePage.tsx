import React, { useState, useEffect } from 'react';
import studentService, { StudentProfileData } from '../../services/student.service';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Users,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Award,
  BookOpen,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils/date.util';

// Reusable FormField card component matching Admin Student Review Page (StudentViewPage.tsx)
const FormField: React.FC<{
  label: string;
  value?: string | number | null;
  mono?: boolean;
  className?: string;
}> = ({ label, value, mono, className = '' }) => (
  <div
    className={`p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/80 rounded-xl transition-all flex flex-col gap-1.5 shadow-2xs ${className}`}
  >
    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">
      {label}
    </p>
    <p
      className={`text-xs font-bold text-neutral-850 dark:text-neutral-200 truncate leading-tight ${
        mono ? 'font-mono' : ''
      }`}
    >
      {value !== null && value !== undefined && String(value).trim() !== '' && String(value) !== 'N/A'
        ? String(value)
        : '—'}
    </p>
  </div>
);

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
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="h-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl animate-pulse" />
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl animate-pulse"
            />
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

  const { student, academic, admission, contact, address, parent, personal, qualifications } = profile;

  // Resolved values
  const firstName = personal?.firstName || student.name.split(' ')[0] || '';
  const middleName = personal?.middleName || '';
  const lastName = personal?.lastName || student.name.split(' ').slice(1).join(' ') || '';
  const fullName = personal?.fullName || student.name;
  const gender = personal?.gender || student.gender;
  const dob = personal?.dateOfBirth || student.dob;
  const formattedDob = dob && dob !== 'N/A' ? formatDateDDMMYYYY(dob) : '—';
  const bloodGroup = student.bloodGroup && student.bloodGroup !== 'N/A' ? student.bloodGroup : '—';
  const category = personal?.category || student.category;
  const caste = personal?.caste || student.caste;
  const religion = personal?.religion || student.religion;
  const nationality = personal?.nationality || student.nationality || 'INDIAN';
  const studiedInKarnataka =
    personal?.studiedInKarnataka !== null && personal?.studiedInKarnataka !== undefined
      ? personal.studiedInKarnataka
        ? 'Yes'
        : 'No'
      : '—';
  const areaType = personal?.areaType || '—';
  const aadhaarMasked = personal?.aadhaarMasked || student.aadhaarNumberMasked;

  // Entrance Exam details
  const entrance = qualifications?.entranceExam;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* ── PROFILE HERO HEADER CARD (Matching Admin Student Review Header) ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center gap-6">
        <ProfileAvatar
          imageUrl={(personal as any)?.profileImage}
          name={fullName}
          size="xl"
          className="border-4 border-indigo-100 dark:border-indigo-950 shadow-md flex-shrink-0"
        />
        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">
              {fullName}
            </h2>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
              <span className="px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-mono font-bold">
                USN: {student.usn}
              </span>
              {admission?.applicationNumber && admission.applicationNumber !== 'N/A' && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700 text-[11px] font-mono font-bold">
                  App: {admission.applicationNumber}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-neutral-500 font-medium">
            {academic.departmentName} ({academic.departmentCode}) • {academic.program || 'Bachelor of Engineering'}
          </p>

          <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-[11px] text-neutral-500 flex-wrap">
            <span className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg font-bold text-neutral-700 dark:text-neutral-300">
              Semester {academic.currentSemester}
            </span>
            <span className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg font-bold text-neutral-700 dark:text-neutral-300">
              Section: {academic.section || 'Unassigned'}
            </span>
            <span className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg font-bold text-neutral-700 dark:text-neutral-300">
              Academic Year: {academic.academicYear}
            </span>
            {admission?.quota && (
              <span className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg font-bold text-neutral-700 dark:text-neutral-300">
                Quota: {admission.quota}
              </span>
            )}
          </div>
        </div>

        {/* Read-Only Status Badge */}
        <div className="flex-shrink-0 self-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified Official Record (Read-Only)</span>
          </span>
        </div>
      </div>

      {/* ── SHEET CONTAINER MIMICKING StudentViewPage.tsx FORM SHEET ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xs p-6 sm:p-8 space-y-8">

        {/* ── SECTION 1: PERSONAL DETAILS (Exact Admin Form Grid) ── */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-500 dark:text-neutral-400 border-l-4 border-violet-500 pl-2.5 flex items-center gap-2">
            <User size={14} className="text-violet-500" /> Personal Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <FormField label="First Name" value={firstName} />
            <FormField label="Middle Name" value={middleName} />
            <FormField label="Last Name" value={lastName} />
            <FormField label="Full Legal Name" value={fullName} />
            <FormField label="Gender" value={gender} />
            <FormField label="Date of Birth" value={formattedDob} />
            <FormField label="Blood Group" value={bloodGroup} />
            <FormField label="Nationality" value={nationality} />
            <FormField label="Religion" value={religion} />
            <FormField label="Caste" value={caste} />
            <FormField label="Category / Reservation" value={category} />
            <FormField label="Area Type" value={areaType} />
            <FormField label="Studied in Karnataka" value={studiedInKarnataka} />
            <FormField label="Aadhaar Number (Masked)" value={aadhaarMasked} mono />
          </div>
        </div>

        <hr className="border-neutral-100 dark:border-neutral-800" />

        {/* ── SECTION 2: PARENT / GUARDIAN DETAILS ── */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-500 dark:text-neutral-400 border-l-4 border-violet-500 pl-2.5 flex items-center gap-2">
            <Users size={14} className="text-violet-500" /> Parent / Guardian Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <FormField label="Father's Full Name" value={parent.fatherName} />
            <FormField label="Father's Occupation" value={parent.fatherOccupation} />
            <FormField label="Father's Phone" value={parent.fatherPhone} mono />
            <FormField label="Father's Email" value={parent.fatherEmail} />
            <FormField label="Mother's Full Name" value={parent.motherName} />
            <FormField label="Mother's Occupation" value={parent.motherOccupation} />
            <FormField label="Mother's Phone" value={parent.motherPhone} mono />
            <FormField label="Mother's Email" value={parent.motherEmail} />
            {parent.guardianName && parent.guardianName !== 'N/A' && (
              <>
                <FormField label="Guardian Name" value={parent.guardianName} />
                <FormField label="Guardian Phone" value={parent.guardianPhone} mono />
              </>
            )}
            <FormField label="Annual Family Income" value={parent.annualIncome} />
          </div>
        </div>

        <hr className="border-neutral-100 dark:border-neutral-800" />

        {/* ── SECTION 3: CONTACT INFORMATION ── */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-500 dark:text-neutral-400 border-l-4 border-violet-500 pl-2.5 flex items-center gap-2">
            <Phone size={14} className="text-violet-500" /> Contact Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <FormField label="Candidate Email" value={contact.studentEmail || student.email} />
            <FormField label="Candidate Mobile" value={contact.studentMobile || student.phone} mono />
            <FormField label="Emergency Contact Number" value={contact.emergencyContact} mono />
          </div>
        </div>

        <hr className="border-neutral-100 dark:border-neutral-800" />

        {/* ── SECTION 4: ADDRESS DETAILS (Current & Permanent Sub-Cards) ── */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-500 dark:text-neutral-400 border-l-4 border-violet-500 pl-2.5 flex items-center gap-2">
            <MapPin size={14} className="text-violet-500" /> Address Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Current Residence */}
            <div className="p-4.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/40 dark:bg-neutral-850/30">
              <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                Current Residence
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <FormField label="Address Line" value={address.correspondence.line1} />
                </div>
                {address.correspondence.line2 && (
                  <div className="col-span-2">
                    <FormField label="Address Line 2" value={address.correspondence.line2} />
                  </div>
                )}
                <FormField label="City" value={address.correspondence.city} />
                <FormField label="District" value={address.correspondence.district} />
                <FormField label="State" value={address.correspondence.state} />
                <FormField label="Pincode" value={address.correspondence.pincode} mono />
              </div>
            </div>

            {/* Permanent Residence */}
            <div className="p-4.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/40 dark:bg-neutral-850/30">
              <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                Permanent Residence
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <FormField label="Address Line" value={address.permanent.line1} />
                </div>
                {address.permanent.line2 && (
                  <div className="col-span-2">
                    <FormField label="Address Line 2" value={address.permanent.line2} />
                  </div>
                )}
                <FormField label="City" value={address.permanent.city} />
                <FormField label="District" value={address.permanent.district} />
                <FormField label="State" value={address.permanent.state} />
                <FormField label="Pincode" value={address.permanent.pincode} mono />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-neutral-100 dark:border-neutral-800" />

        {/* ── SECTION 5: ADMISSION & INSTITUTIONAL ENROLLMENT ── */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-500 dark:text-neutral-400 border-l-4 border-violet-500 pl-2.5 flex items-center gap-2">
            <Award size={14} className="text-violet-500" /> Admission & Institutional Enrollment
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <FormField label="Application Number" value={admission?.applicationNumber} mono />
            <FormField label="University Seat No (USN)" value={student.usn} mono />
            <FormField label="Admission Quota" value={admission?.quota || 'KCET'} />
            <FormField label="Admission Type" value={admission?.admissionType || 'KCET'} />
            <FormField label="KCET / DCET Number" value={entrance?.cetNumber || entrance?.dcetNumber || admission?.applicationNumber} mono />
            <FormField label="Entrance Exam Rank" value={entrance?.cetRank || academic.rank} mono />
            {entrance?.cetScore && <FormField label="Entrance Score" value={entrance.cetScore} />}
            <FormField
              label="Enrolled On / Admission Date"
              value={admission?.enrolledAt ? formatDateDDMMYYYY(admission.enrolledAt) : '—'}
            />
            <FormField label="Degree Program" value={academic.program} />
            <FormField label="Department Code" value={academic.departmentCode} />
            <FormField label="Department Name" value={academic.departmentName} />
            <FormField label="Current Semester" value={`Semester ${academic.currentSemester}`} />
            <FormField label="Allocated Section" value={academic.section || 'Unassigned'} />
            <FormField label="Academic Year" value={academic.academicYear} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentProfilePage;
