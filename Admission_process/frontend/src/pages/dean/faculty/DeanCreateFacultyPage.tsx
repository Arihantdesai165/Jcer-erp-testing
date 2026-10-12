import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Shield,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import deanService, { DepartmentRecord } from '../../../services/dean.service';
import usePersistentFormState from '../../../hooks/usePersistentFormState';

interface DeanCreateFacultyFormState {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  email: string;
  phone: string;
  designation: string;
  joiningDate: string;
  coreDepartmentId: string;
}

const defaultDeanFacultyForm: DeanCreateFacultyFormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  gender: 'Male',
  email: '',
  phone: '',
  designation: 'Assistant Professor',
  joiningDate: new Date().toISOString().split('T')[0],
  coreDepartmentId: '',
};

export const DeanCreateFacultyPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const isIndividualForm = mode === 'individual' || mode === 'single';

  // Persistent Form State with LocalStorage
  const {
    formState,
    updateField,
    clearDraft,
  } = usePersistentFormState<DeanCreateFacultyFormState>(
    'dean_create_faculty_form_v1',
    defaultDeanFacultyForm
  );

  const {
    firstName,
    middleName,
    lastName,
    gender,
    email,
    phone,
    designation,
    joiningDate,
    coreDepartmentId,
  } = formState;

  const setFirstName = (val: string) => updateField('firstName', val);
  const setMiddleName = (val: string) => updateField('middleName', val);
  const setLastName = (val: string) => updateField('lastName', val);
  const setGender = (val: string) => updateField('gender', val);
  const setEmail = (val: string) => updateField('email', val);
  const setPhone = (val: string) => updateField('phone', val);
  const setDesignation = (val: string) => updateField('designation', val);
  const setJoiningDate = (val: string) => updateField('joiningDate', val);
  const setCoreDepartmentId = (val: string) => updateField('coreDepartmentId', val);

  // Departments state loaded dynamically from database
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState<boolean>(true);

  // Load departments from backend database
  useEffect(() => {
    let isMounted = true;
    const loadDepts = async () => {
      try {
        const data = await deanService.getDepartments();
        if (isMounted && data) {
          setDepartments(data);
        }
      } catch (err) {
        console.error('Failed to load departments:', err);
      } finally {
        if (isMounted) setLoadingDepartments(false);
      }
    };
    loadDepts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Form submission and feedback state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Success Modal State
  const [successModalData, setSuccessModalData] = useState<{
    email: string;
    temporaryPassword: string;
    facultyName: string;
    departmentName: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form Validations
    if (!firstName.trim()) {
      setErrorMessage('Please enter faculty first name.');
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage('Please enter faculty last name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid faculty college email address.');
      return;
    }
    if (!coreDepartmentId) {
      setErrorMessage('Please select a Core Department.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await deanService.createFaculty({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        gender: gender || undefined,
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        designation: designation.trim(),
        joiningDate: joiningDate || undefined,
        coreDepartmentId,
      });

      // Clear cached draft upon successful submission
      clearDraft();

      const matchedDept = departments.find((d) => d.id === coreDepartmentId);
      const deptLabel = matchedDept ? `${matchedDept.name} (${matchedDept.code})` : 'Global Directory';

      setSuccessModalData({
        email: email.trim().toLowerCase(),
        temporaryPassword: response.data?.temporaryCredentials?.temporaryPassword || 'Faculty@123',
        facultyName: [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' '),
        departmentName: deptLabel,
      });
    } catch (err: any) {
      console.error('Faculty creation error:', err);
      const backendErr =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to create faculty account. Please check the information and try again.';
      setErrorMessage(backendErr);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isIndividualForm) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* ── Breadcrumb Bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            to="/dean/faculty"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Faculty Directory</span>
          </Link>
        </div>

        {/* ── Page Header ────────────────────────────────────────────── */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Create Faculty
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Choose how you would like to onboard faculty members into the Global Faculty Directory.
              </p>
            </div>
          </div>
        </div>

        {/* ── 2 Option Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Option 1: Create Individual Faculty */}
          <div
            onClick={() => setSearchParams({ mode: 'individual' })}
            className="group relative cursor-pointer glass-card rounded-3xl p-7 border-2 border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm hover:shadow-xl hover:border-indigo-500/80 dark:hover:border-indigo-500/80 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:!text-white transition-all duration-200 shadow-sm">
                  <UserPlus className="w-7 h-7 text-indigo-600 dark:text-indigo-400 group-hover:!text-white group-hover:!stroke-white transition-colors duration-200" strokeWidth={2.2} />
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                  Single Faculty
                </span>
              </div>

              <h2 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Create Individual Faculty
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Add a single faculty member directly with personal details, designation, email, phone number, and primary department assignment.
              </p>

              <div className="mt-5 space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Immediate active account creation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Direct home department allocation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Auto-saved session draft protection</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-bold text-xs">
              <span>Proceed to Individual Form</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* Option 2: Bulk Import Faculty */}
          <div
            onClick={() => navigate('/dean/faculty/bulk-import')}
            className="group relative cursor-pointer glass-card rounded-3xl p-7 border-2 border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm hover:shadow-xl hover:border-emerald-500/80 dark:hover:border-emerald-500/80 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:!text-white transition-all duration-200 shadow-sm">
                  <FileSpreadsheet className="w-7 h-7 text-emerald-600 dark:text-emerald-400 group-hover:!text-white group-hover:!stroke-white transition-colors duration-200" strokeWidth={2.2} />
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                  Bulk Excel Import
                </span>
              </div>

              <h2 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Bulk Import Faculty
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Upload multiple faculty records simultaneously using the official Excel template with automated department validation and bulk login credential generation.
              </p>

              <div className="mt-5 space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Standardized .xlsx template provided</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Real-time database validation checks</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Batch accounts with credentials export</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              <span>Go to Bulk Import Page</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Breadcrumb & Draft Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Create Options</span>
          </button>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <Link
            to="/dean/faculty"
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Faculty Directory
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
            <Sparkles className="w-3 h-3" />
            <span>Session Auto-Saved</span>
          </span>
          <button
            type="button"
            onClick={() => clearDraft()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
            title="Reset form draft"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Draft</span>
          </button>
        </div>
      </div>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Create Faculty
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Add a new faculty member directly to the Global Faculty Directory with immediate ACTIVE status.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION A: PERSONAL & CONTACT INFORMATION */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>SECTION A: PERSONAL & CONTACT INFORMATION</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter the faculty member's official college details.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sumit"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Kumar"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Desai"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Gender <span className="text-rose-500">*</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                <span>Faculty College Email</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. sumit.desai@jcer.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Academic Designation <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Professor">Professor</option>
                <option value="Adjunct Faculty">Adjunct Faculty</option>
                <option value="Lecturer">Lecturer</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Joining Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION B: ACADEMIC INFORMATION */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>SECTION B: ACADEMIC INFORMATION</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select the permanent home academic department for this faculty member.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                CORE DEPARTMENT <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={coreDepartmentId}
                onChange={(e) => setCoreDepartmentId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="">
                  {loadingDepartments ? '-- Loading Departments... --' : '-- Select Core Department --'}
                </option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Permanent/home academic department of the faculty member.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/dean/faculty"
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating Faculty...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Faculty</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Success Modal with Confirmation & Credentials ─────────────────────── */}
      {successModalData &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Faculty Created Successfully
                </h3>
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-900 dark:text-white">{successModalData.facultyName}</strong> has been added to the Global Faculty Directory under <span className="font-semibold text-indigo-600 dark:text-indigo-400">{successModalData.departmentName}</span>.
                </p>
              </div>

              {/* Status Box */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-1.5 font-black text-[13px]">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Status: ACTIVE (Global Directory)</span>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  This faculty is immediately active and available for teaching allocations across any academic department.
                </p>
              </div>

              {/* Temporary Credentials */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Login Username / Email</span>
                  <p className="text-xs font-mono font-bold text-slate-900 dark:text-white">{successModalData.email}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Temporary Password</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">{successModalData.temporaryPassword}</p>
                    <button
                      onClick={() => copyToClipboard(`Email: ${successModalData.email}\nPassword: ${successModalData.temporaryPassword}`)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-200 transition-colors"
                      title="Copy credentials"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSuccessModalData(null);
                    navigate('/dean/faculty');
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Go to Faculty Directory
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DeanCreateFacultyPage;
