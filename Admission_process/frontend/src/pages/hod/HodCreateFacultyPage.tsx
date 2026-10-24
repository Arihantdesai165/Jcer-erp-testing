import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import hodService from '../../services/hod.service';
import usePersistentFormState from '../../hooks/usePersistentFormState';

interface CreateFacultyFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  joiningDate: string;
  coreDepartmentId: string;
}

const defaultFacultyForm: CreateFacultyFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  designation: 'Assistant Professor',
  joiningDate: new Date().toISOString().split('T')[0],
  coreDepartmentId: '',
};

export const HodCreateFacultyPage: React.FC = () => {
  const navigate = useNavigate();

  // Persistent Form State with LocalStorage
  const {
    formState,
    updateField,
    clearDraft,
  } = usePersistentFormState<CreateFacultyFormState>('hod_create_faculty_form_v2', defaultFacultyForm);

  const {
    firstName,
    lastName,
    email,
    phone,
    designation,
    joiningDate,
    coreDepartmentId,
  } = formState;

  const setFirstName = (val: string) => updateField('firstName', val);
  const setLastName = (val: string) => updateField('lastName', val);
  const setEmail = (val: string) => updateField('email', val);
  const setPhone = (val: string) => updateField('phone', val);
  const setDesignation = (val: string) => updateField('designation', val);
  const setJoiningDate = (val: string) => updateField('joiningDate', val);
  const setCoreDepartmentId = (val: string) => updateField('coreDepartmentId', val);

  // Departments state loaded from database
  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [loadingDepartments, setLoadingDepartments] = useState<boolean>(true);

  // Load departments from backend database
  React.useEffect(() => {
    let isMounted = true;
    const loadDepts = async () => {
      try {
        const data = await hodService.getDepartments();
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
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
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

    setSubmitting(true);
    try {
      const response = await hodService.createFaculty({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        designation: designation.trim(),
        joiningDate: joiningDate || undefined,
        coreDepartmentId: coreDepartmentId || undefined,
      });

      // Clear cached draft upon successful submission
      clearDraft();

      setSuccessModalData({
        email: email.trim().toLowerCase(),
        temporaryPassword: response.data?.temporaryCredentials?.temporaryPassword || 'GeneratedSecurePass123',
        facultyName: `${firstName.trim()} ${lastName.trim()}`,
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* ── Back & Draft Bar ── */}
      <div className="flex items-center justify-between">
        <Link
          to="/hod/faculty"
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
          <span>Back to Faculty List</span>
        </Link>

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
              Create the faculty member's profile and submit for automatic sequential authorization.
            </p>
          </div>
        </div>

        {/* Automatic Sequential Workflow Info Card */}
        <div className="mt-6 p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-[13px] text-blue-950 dark:text-blue-100">
              Automatic Two-Stage Authorization Workflow:
            </p>
            <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
              Upon submission, this account will be created with status <strong className="font-bold underline">PENDING_AUTHORIZATION</strong> and routed automatically through the sequential authorization pipeline:
              <span className="font-bold text-blue-950 dark:text-blue-100"> 1. Dean Academics → 2. Principal</span>. Subject assignments can be allocated separately after authorization.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Anil"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
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
                placeholder="e.g. Kumar"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                <span>Faculty College Email</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. anil.kumar@jcer.edu"
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
                Permanent home department of the faculty member.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/hod/faculty"
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
                <span>Submitting for Authorization...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Create Faculty & Submit for Authorization</span>
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
                  Authorization Request Sent
                </h3>
                <p className="text-xs text-slate-500">
                  Your faculty creation request for <strong className="text-slate-900 dark:text-white">{successModalData.facultyName}</strong> has been submitted for authorization.
                  The request has been sent to the designated academic/institutional authorities.
                </p>
              </div>

              {/* Status Box */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 font-black text-[13px]">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Status: PENDING AUTHORIZATION</span>
                </div>
                <div className="text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                  <p>
                    The faculty account will enter the sequential authorization queue:
                  </p>
                  <p className="font-bold">
                    Step 1: Dean Academics → Step 2: Principal
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    Faculty login is disabled until both authorizations are completed.
                  </p>
                </div>
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
                    navigate('/hod/faculty');
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Go to Faculty List
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default HodCreateFacultyPage;
