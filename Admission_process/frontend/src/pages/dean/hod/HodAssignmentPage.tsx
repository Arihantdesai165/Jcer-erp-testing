import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, UserCheck, Calendar, Building2, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import deanService, { HodRecord, DepartmentRecord, AcademicYearRecord } from '../../../services/dean.service';
import { toast } from 'react-toastify';

export const HodAssignmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [hods, setHods] = useState<HodRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form
  const [selectedHodUserId, setSelectedHodUserId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('2026-27');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [hodList, deptList, yearList] = await Promise.all([
          deanService.getHods(),
          deanService.getDepartments(),
          deanService.getAcademicYears(),
        ]);
        setHods(hodList);
        setDepartments(deptList);
        setAcademicYears(yearList);

        // Preselect from query params if passed
        const queryHodUserId = searchParams.get('hodUserId');
        const queryDeptId = searchParams.get('dept');

        if (queryHodUserId) {
          setSelectedHodUserId(queryHodUserId);
        } else if (hodList.length > 0) {
          setSelectedHodUserId(hodList[0].userId);
        }

        if (queryDeptId) {
          setSelectedDeptId(queryDeptId);
        } else if (deptList.length > 0) {
          setSelectedDeptId(deptList[0].id);
        }

        const activeYr = yearList.find((y) => y.isCurrent)?.year || '2026-27';
        setSelectedYear(activeYr);
      } catch (err) {
        toast.error('Failed to load assignment dependencies');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [searchParams]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHodUserId || !selectedDeptId || !selectedYear || !startDate) {
      toast.error('Please complete all mandatory assignment fields');
      return;
    }

    try {
      setSaving(true);
      await deanService.assignHod({
        hodUserId: selectedHodUserId,
        departmentId: selectedDeptId,
        academicYear: selectedYear,
        startDate,
        endDate: endDate || undefined,
      });

      toast.success('HOD successfully assigned to department.');
      navigate('/dean/hods');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to assign HOD');
    } finally {
      setSaving(false);
    }
  };

  const selectedHod = hods.find((h) => h.userId === selectedHodUserId);
  const selectedDept = departments.find((d) => d.id === selectedDeptId);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

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

      {/* ── ASSIGNMENT CARD ── */}
      <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-amber-600" />
            <span>Assign HOD to Department</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Designate a qualified faculty member as Head of Department (HOD) for a specified academic session.
          </p>
        </div>

        <form onSubmit={handleAssign} className="p-6 space-y-6">

          {/* HOD Selector */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Select Head of Department (HOD) *
            </label>
            <select
              value={selectedHodUserId}
              onChange={(e) => setSelectedHodUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-semibold"
              required
            >
              {hods.map((h) => (
                <option key={h.id} value={h.userId}>
                  {h.name} ({h.email}) — Current Dept: {h.departmentCode || 'None'}
                </option>
              ))}
            </select>
          </div>

          {/* Department Selector */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Select Department to Appoint *
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-semibold"
              required
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name} {d.hod ? `(Current HOD: ${d.hod.name})` : '(No HOD Appointed)'}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Session */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Academic Session Year *
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
              required
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.year}>
                  Academic Year {y.year} {y.isCurrent ? '(Active Session)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Tenure Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Tenure End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Preview Box */}
          {selectedHod && selectedDept && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-700 dark:text-amber-400 block">
                Assignment Summary
              </span>
              <p>
                Assigning <span className="font-bold">{selectedHod.name}</span> as Head of Department for{' '}
                <span className="font-bold">{selectedDept.name} ({selectedDept.code})</span> during Academic Year{' '}
                <span className="font-bold">{selectedYear}</span>.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Any previous active assignment for this department will be automatically archived into assignment history.
              </p>
            </div>
          )}

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
              <UserCheck className="w-4 h-4" />
              <span>{saving ? 'Assigning...' : 'Assign HOD'}</span>
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};

export default HodAssignmentPage;
