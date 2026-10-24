import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAcademicYear } from '../../../context/AcademicYearContext';
import facultyService, {
  AssignmentComponentDef,
  AssignmentWorkspaceData,
} from '../../../services/faculty.service';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  Layers,
  Save,
  Check,
  Sparkles,
  Info,
  BookOpen,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const SUGGESTED_COMPONENTS = [
  'Lab CIE',
  'Assignment',
];

export const FacultyAssignmentConfigPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();

  const subjectId = searchParams.get('subjectId') || '';
  const semester = parseInt(searchParams.get('semester') || '1', 10);

  const [workspace, setWorkspace] = useState<AssignmentWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Configuration Choice: 'SINGLE' | 'DIVIDED'
  const [assignmentChoice, setAssignmentChoice] = useState<'SINGLE' | 'DIVIDED'>('SINGLE');

  // Divided Components Builder
  const [components, setComponents] = useState<AssignmentComponentDef[]>([
    { id: 'assignment_1', label: 'Assignment 1', maxMarks: 5 },
    { id: 'assignment_2', label: 'Assignment 2', maxMarks: 5 },
    { id: 'quiz', label: 'Quiz', maxMarks: 5 },
    { id: 'seminar', label: 'Seminar', maxMarks: 10 },
  ]);

  const [hasExistingMarks, setHasExistingMarks] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!subjectId) return;
      try {
        setLoading(true);
        const data = await facultyService.getAssignmentWorkspace(subjectId, semester, academicYear);
        setWorkspace(data);

        // Check if marks exist
        const marksCount = data.students.filter((s) =>
          Object.values(s.marks).some((v) => v !== null && v !== undefined)
        ).length;
        setHasExistingMarks(marksCount > 0);

        if (data.isConfigured && data.configuration?.components && data.configuration.components.length > 0) {
          const comps = data.configuration.components;
          if (comps.length === 1 && comps[0].maxMarks === 25) {
            setAssignmentChoice('SINGLE');
          } else {
            setAssignmentChoice('DIVIDED');
            setComponents(comps);
          }
        } else {
          setAssignmentChoice('SINGLE');
        }
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to load assignment configuration.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [subjectId, semester, academicYear]);

  const currentTotal = useMemo(() => {
    if (assignmentChoice === 'SINGLE') return 25;
    return components.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);
  }, [assignmentChoice, components]);

  const isValid = useMemo(() => {
    if (assignmentChoice === 'SINGLE') return true;
    if (currentTotal !== 25) return false;
    for (const c of components) {
      if (!c.label.trim()) return false;
      const m = Number(c.maxMarks);
      if (isNaN(m) || m <= 0) return false;
    }
    return true;
  }, [assignmentChoice, currentTotal, components]);

  const handleAddComponent = (suggestedName?: string) => {
    const nextIdx = components.length + 1;
    const label = suggestedName || `Component ${nextIdx}`;
    const id = `comp_${Date.now().toString(36)}_${nextIdx}`;
    setComponents([...components, { id, label, maxMarks: 5 }]);
  };

  const handleRemoveComponent = (idx: number) => {
    if (components.length <= 1) {
      toast.error('At least one component is required.');
      return;
    }
    const updated = [...components];
    updated.splice(idx, 1);
    setComponents(updated);
  };

  const handleUpdateComponent = (
    idx: number,
    field: 'label' | 'maxMarks',
    val: string | number
  ) => {
    const updated = [...components];
    if (field === 'maxMarks') {
      updated[idx] = { ...updated[idx], maxMarks: Number(val) || 0 };
    } else {
      updated[idx] = { ...updated[idx], label: String(val) };
    }
    setComponents(updated);
  };

  const handleSave = async () => {
    let componentsToSave: AssignmentComponentDef[] = [];

    if (assignmentChoice === 'SINGLE') {
      componentsToSave = [{ id: 'assignment', label: 'Assignment', maxMarks: 25 }];
    } else {
      // Validate
      if (components.length === 0) {
        toast.error('Please add at least one component.');
        return;
      }
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        if (!c.label.trim()) {
          toast.error(`Component #${i + 1} name cannot be empty.`);
          return;
        }
        const m = Number(c.maxMarks);
        if (isNaN(m) || m <= 0) {
          toast.error(`Component "${c.label}" marks must be greater than 0.`);
          return;
        }
      }
      if (currentTotal !== 25) {
        toast.error('Assignment components must total exactly 25 marks.');
        return;
      }
      componentsToSave = components;
    }

    if (hasExistingMarks) {
      const confirm = window.confirm(
        'Changing the assignment pattern may affect the existing assignment marks structure. Continue?'
      );
      if (!confirm) return;
    }

    try {
      setSaving(true);
      await facultyService.saveAssignmentConfiguration({
        subjectId,
        semester,
        components: componentsToSave,
        confirmPatternChange: true,
        academicYear,
      });

      toast.success('Assignment configuration saved successfully!');
      navigate(`/faculty/marks/assignments?subjectId=${subjectId}&semester=${semester}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save assignment configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-neutral-600 dark:text-neutral-400 font-bold text-sm tracking-wide">
          Loading Assignment Configuration...
        </p>
      </div>
    );
  }

  const subjectInfo = workspace?.configuration || {
    subjectName: workspace?.subject?.name || 'Subject',
    subjectCode: workspace?.subject?.code || 'SUB',
    departmentName: workspace?.department?.name || 'Department of Computer Science & Engineering',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col justify-between">
      {/* ── TOP HEADER ── */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 sm:px-8 flex items-center justify-between shadow-xs sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/faculty/marks/semesters/${semester}`)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Back to Semester Subjects"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 font-mono font-bold text-xs">
                {subjectInfo.subjectCode}
              </span>
              <h1 className="font-extrabold text-base sm:text-lg text-neutral-900 dark:text-white">
                {subjectInfo.subjectName} — Assignment Marks Configuration
              </h1>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Semester {semester} • Academic Year {academicYear} • Total Available: <strong>25 Marks</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/faculty/marks/semesters/${semester}`)}
            className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Assignment Pattern'}</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONFIGURATION WORKSPACE ── */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-8 space-y-6 flex-1">
        {/* Existing Marks Notice */}
        {hasExistingMarks && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <p>
              <strong>Existing Marks:</strong> Modifying components updates the template while preserving existing marks.
            </p>
          </div>
        )}

        {/* Total Marks Banner Card */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md flex flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black">Assignment Marks Scheme</h2>
            <p className="text-xs text-purple-200 mt-0.5">
              Continuous Internal Evaluation component
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
            <span className="font-mono font-black text-2xl">25</span>
            <span className="font-bold text-xs text-purple-200 uppercase">Marks</span>
          </div>
        </div>

        {/* Choice Step */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Assignment Structure
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Select how assignment marks will be entered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option A: Single Assignment */}
            <div
              onClick={() => setAssignmentChoice('SINGLE')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 relative ${
                assignmentChoice === 'SINGLE'
                  ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-850/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-neutral-900 dark:text-white">
                  Single Assignment (25M)
                </span>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    assignmentChoice === 'SINGLE'
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-neutral-400 dark:border-neutral-600'
                  }`}
                >
                  {assignmentChoice === 'SINGLE' && <Check className="w-2.5 h-2.5" />}
                </div>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Direct single mark entry out of 25M per student.
              </p>
            </div>

            {/* Option B: Divide Assignment */}
            <div
              onClick={() => setAssignmentChoice('DIVIDED')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 relative ${
                assignmentChoice === 'DIVIDED'
                  ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-850/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-neutral-900 dark:text-white">
                  Divide Assignment (25M)
                </span>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    assignmentChoice === 'DIVIDED'
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-neutral-400 dark:border-neutral-600'
                  }`}
                >
                  {assignmentChoice === 'DIVIDED' && <Check className="w-2.5 h-2.5" />}
                </div>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Split into sub-components (e.g. Lab CIE + Assignment).
              </p>
            </div>
          </div>
        </div>

        {/* Component Builder Panel (Visible when DIVIDED is selected) */}
        {assignmentChoice === 'DIVIDED' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Divide Assignment Marks
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Specify components and marks (Total must equal 25M).
                </p>
              </div>

              {/* Live Counter Badge */}
              <div
                className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 ${
                  currentTotal === 25
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                {currentTotal === 25 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>Total: {currentTotal} / 25 Marks</span>
              </div>
            </div>

            {/* Quick Add Suggestions */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Quick Add:
              </span>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_COMPONENTS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleAddComponent(name)}
                    className="px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-purple-100 dark:hover:bg-purple-950/60 hover:text-purple-700 dark:hover:text-purple-300 text-neutral-700 dark:text-neutral-300 font-bold text-xs border border-neutral-200 dark:border-neutral-700 transition-colors"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Components Dynamic Table */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-12 gap-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-3">
                <span className="col-span-1 text-center">#</span>
                <span className="col-span-7">Component Name</span>
                <span className="col-span-3 text-center">Max Marks</span>
                <span className="col-span-1 text-center">Action</span>
              </div>

              <div className="space-y-2.5">
                {components.map((comp, idx) => (
                  <div
                    key={comp.id || idx}
                    className="grid grid-cols-12 gap-3 items-center p-3 bg-neutral-50 dark:bg-neutral-850 rounded-2xl border border-neutral-200 dark:border-neutral-750 transition-all hover:border-neutral-300 dark:hover:border-neutral-650"
                  >
                    <span className="col-span-1 text-center font-mono font-bold text-xs text-neutral-400">
                      {idx + 1}
                    </span>

                    <div className="col-span-7">
                      <input
                        type="text"
                        value={comp.label}
                        onChange={(e) => handleUpdateComponent(idx, 'label', e.target.value)}
                        placeholder="e.g. Assignment 1, Quiz, Seminar, Project..."
                        className="w-full px-3.5 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
                      />
                    </div>

                    <div className="col-span-3 flex items-center justify-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="25"
                        value={comp.maxMarks || ''}
                        onChange={(e) => handleUpdateComponent(idx, 'maxMarks', e.target.value)}
                        className="w-20 px-3 py-2 text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono font-black text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
                      />
                      <span className="text-xs font-bold text-neutral-500">M</span>
                    </div>

                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveComponent(idx)}
                        className="p-2 rounded-xl text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                        title="Remove Component"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Custom Component & Live Delta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleAddComponent()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-bold text-xs transition-colors w-fit"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Custom Component</span>
              </button>

              {currentTotal !== 25 && (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Adjustment needed:{' '}
                  <strong>
                    {25 - currentTotal > 0 ? `+${25 - currentTotal}` : 25 - currentTotal}M
                  </strong>
                </span>
              )}
            </div>

            {/* Validation Banner */}
            {currentTotal !== 25 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                <span>Assignment components must total exactly 25 marks.</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── STICKY BOTTOM SAVE BAR ── */}
      <footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 sm:px-8 flex items-center justify-between sticky bottom-0 z-30 shadow-md">
        <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          Pattern Mode:{' '}
          <strong className="text-purple-700 dark:text-purple-300">
            {assignmentChoice === 'SINGLE'
              ? 'Single Assignment (25M)'
              : `Divided into ${components.length} Components (${currentTotal}/25M)`}
          </strong>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/faculty/marks/semesters/${semester}`)}
            className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Pattern...' : 'Save Assignment Pattern'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default FacultyAssignmentConfigPage;
