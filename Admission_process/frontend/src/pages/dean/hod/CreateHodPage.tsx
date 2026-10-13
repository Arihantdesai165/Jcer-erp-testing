import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, CheckCircle2, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import deanService, { DepartmentRecord, AcademicYearRecord } from '../../../services/dean.service';
import { toast } from 'react-toastify';

export const CreateHodPage: React.FC = () => {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Professor & Head of Department');
  const [departmentId, setDepartmentId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [tempPassword, setTempPassword] = useState('password123');

  const [saving, setSaving] = useState(false);
  const [createdResult, setCreatedResult] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [depts, yrs] = await Promise.all([
          deanService.getDepartments(),
          deanService.getAcademicYears(),
        ]);
        setDepartments(depts);
        setAcademicYears(yrs);
        if (depts.length > 0) setDepartmentId(depts[0].id);
        const activeYr = yrs.find((y) => y.isCurrent)?.year || '2026-27';
        setAcademicYear(activeYr);
      } catch (err) {
        toast.error('Failed to load department metadata');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !departmentId) {
      toast.error('Please fill in all mandatory fields');
      return;
    }

    try {
      setSaving(true);
      const res = await deanService.createHod({
        firstName,
        lastName,
        email,
        phone,
        designation,
        departmentId,
        academicYear,
        joiningDate,
        tempPassword,
      });

      toast.success('HOD created successfully.');
      setCreatedResult({
        name: `${firstName} ${lastName}`,
        email: email.trim().toLowerCase(),
        temporaryPassword: res.data.temporaryPassword || tempPassword,
        department: departments.find((d) => d.id === departmentId)?.name || 'Department',
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create HOD account');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info('Copied to clipboard!');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── BACK BUTTON ── */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => navigate('/dean/hods')}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to HOD Directory</span>
        </button>
      </div>

      {/* ── SUCCESS BANNER IF CREATED ── */}
      {createdResult && (
        <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-4 animate-in fade-in">
          <div className="flex items-center space-x-3 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <div>
              <h3 className="text-base font-bold">HOD Account Created Successfully!</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                The new HOD profile and login credentials have been provisioned in the JCER ERP.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-emerald-100 dark:border-emerald-900/30 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-400">HOD Name</span>
              <p className="font-bold text-neutral-900 dark:text-white">{createdResult.name}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-400">Core Department</span>
              <p className="font-bold text-neutral-900 dark:text-white">{createdResult.department}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-400">Login Email</span>
              <div className="flex items-center space-x-2">
                <code className="font-bold text-amber-700 dark:text-amber-300">{createdResult.email}</code>
                <button onClick={() => copyToClipboard(createdResult.email)} className="text-neutral-400 hover:text-neutral-900">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-400">Temporary Password</span>
              <div className="flex items-center space-x-2">
                <code className="font-bold text-emerald-700 dark:text-emerald-400">{createdResult.temporaryPassword}</code>
                <button onClick={() => copyToClipboard(createdResult.temporaryPassword)} className="text-neutral-400 hover:text-neutral-900">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={() => navigate('/dean/hods')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
            >
              Go to HOD Directory
            </button>
            <button
              onClick={() => {
                setCreatedResult(null);
                setFirstName('');
                setLastName('');
                setEmail('');
                setPhone('');
              }}
              className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300 font-bold text-xs"
            >
              + Create Another HOD
            </button>
          </div>
        </div>
      )}

      {/* ── FORM CARD ── */}
      {!createdResult && (
        <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
          <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-amber-600" />
              <span>Create New Department Head (HOD)</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Provision a new faculty user account with the HOD role, assign them to a department, and generate temporary login credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* Section 1: Personal Information */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                1. Personal Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. hod.cse@college.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Academic Assignment */}
            <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                2. Academic Assignment
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Core Department *
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Official appointment department and core teaching department.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Academic Year Session *
                  </label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.year}>
                        {y.year} {y.isCurrent ? '(Active Session)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Tenure Joining Date
                  </label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Credentials */}
            <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                3. Login Credentials
              </h3>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>Temporary Password Generation</span>
                </div>
                <div>
                  <input
                    type="text"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Set temporary password"
                    className="w-full max-w-sm px-3.5 py-2 rounded-xl text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    The HOD will be prompted to update their password upon initial ERP sign-in.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => navigate('/dean/hods')}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center space-x-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>{saving ? 'Creating HOD Account...' : 'Create HOD Account'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};

export default CreateHodPage;
