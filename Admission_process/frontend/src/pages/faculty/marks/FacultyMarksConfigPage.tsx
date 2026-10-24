import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAcademicYear } from '../../../context/AcademicYearContext';
import facultyService, {
  AssessmentConfigData,
  MainQuestionDef,
  SubQuestionDef,
  AttemptRulesDef,
  QuestionGroupRule,
} from '../../../services/faculty.service';
import {
  ArrowLeft,
  Settings,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Eye,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Layers,
  HelpCircle,
  Check,
  Copy,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const FacultyMarksConfigPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();

  const subjectId = searchParams.get('subjectId') || '';
  const semester = parseInt(searchParams.get('semester') || '1', 10);
  const initialAssessmentType = (searchParams.get('assessmentType') as 'CIE1' | 'CIE2') || 'CIE1';

  const [assessmentType, setAssessmentType] = useState<'CIE1' | 'CIE2'>(initialAssessmentType);
  const [config, setConfig] = useState<AssessmentConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Copy CIE-1 State
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [loadingCie1, setLoadingCie1] = useState(false);

  // Form State
  const [maximumMarks, setMaximumMarks] = useState<number>(50);
  const [questions, setQuestions] = useState<MainQuestionDef[]>([]);
  const [attemptType, setAttemptType] = useState<'GROUPED_BEST_OF' | 'COMPULSORY_ALL'>('GROUPED_BEST_OF');
  const [groups, setGroups] = useState<QuestionGroupRule[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [incompatibleWarning, setIncompatibleWarning] = useState<string | null>(null);

  const fetchConfig = async () => {
    if (!subjectId) return;
    try {
      setLoading(true);
      const data = await facultyService.getAssessmentConfig(subjectId, semester, assessmentType, academicYear);
      setConfig(data);
      setMaximumMarks(data.maximumMarks || 50);
      setQuestions(data.questionPattern || []);
      setAttemptType(data.attemptRules?.type || 'GROUPED_BEST_OF');
      setGroups(data.attemptRules?.groups || []);
      setIncompatibleWarning(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load assessment configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [subjectId, semester, assessmentType, academicYear]);

  // Optional Copy CIE-1 Handlers
  const handleInitiateCopyCie1 = async () => {
    if (!subjectId) return;
    try {
      setLoadingCie1(true);
      const cie1Data = await facultyService.getAssessmentConfig(subjectId, semester, 'CIE1', academicYear);
      if (!cie1Data.questionPattern || cie1Data.questionPattern.length === 0) {
        toast.error('CIE-1 pattern is not configured yet. Configure CIE-1 first or continue with manual CIE-2 configuration.', {
          duration: 5000,
        });
        return;
      }
      setShowCopyModal(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to check CIE-1 pattern.');
    } finally {
      setLoadingCie1(false);
    }
  };

  const handleConfirmCopyCie1 = async () => {
    try {
      setLoadingCie1(true);
      const cie1Data = await facultyService.getAssessmentConfig(subjectId, semester, 'CIE1', academicYear);
      if (!cie1Data.questionPattern || cie1Data.questionPattern.length === 0) {
        toast.error('CIE-1 pattern is not configured yet.');
        setShowCopyModal(false);
        return;
      }

      // Deep clone with new IDs to guarantee 100% independence between CIE-1 and CIE-2
      const idMap: Record<string, string> = {};
      const clonedQuestions: MainQuestionDef[] = cie1Data.questionPattern.map((q, qIdx) => {
        const newQId = `q${qIdx + 1}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        idMap[q.id] = newQId;
        return {
          ...q,
          id: newQId,
          subquestions: (q.subquestions || []).map((sub, sIdx) => ({
            ...sub,
            id: `sub_${sub.label || sIdx}_${Date.now().toString(36)}_${sIdx}_${Math.random().toString(36).substring(2, 6)}`,
          })),
        };
      });

      const clonedGroups: QuestionGroupRule[] = (cie1Data.attemptRules?.groups || []).map((g, gIdx) => ({
        ...g,
        id: `g${gIdx + 1}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        questionIds: (g.questionIds || []).map((oldId) => idMap[oldId] || oldId),
      }));

      setMaximumMarks(cie1Data.maximumMarks || 50);
      setQuestions(clonedQuestions);
      setAttemptType(cie1Data.attemptRules?.type || 'GROUPED_BEST_OF');
      setGroups(clonedGroups);
      setShowCopyModal(false);

      toast.success('CIE-1 question pattern copied into CIE-2! You can modify it before saving.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to copy CIE-1 pattern.');
    } finally {
      setLoadingCie1(false);
    }
  };

  // Main Question Handlers
  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    const newQ: MainQuestionDef = {
      id: `q${nextNum}_${Date.now().toString(36)}`,
      questionNumber: nextNum,
      label: `Q${nextNum}`,
      maxMarks: 25,
      subquestions: [
        { id: `sub_a_${Date.now().toString(36)}`, label: 'a', maxMarks: 6 },
        { id: `sub_b_${Date.now().toString(36)}`, label: 'b', maxMarks: 7 },
        { id: `sub_c_${Date.now().toString(36)}`, label: 'c', maxMarks: 6 },
        { id: `sub_d_${Date.now().toString(36)}`, label: 'd', maxMarks: 6 },
      ],
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (qIndex: number) => {
    if (questions.length <= 1) {
      toast.error('At least one main question must remain.');
      return;
    }
    const updated = questions.filter((_, idx) => idx !== qIndex);
    setQuestions(updated);
  };

  const handleUpdateQuestionLabel = (qIndex: number, label: string) => {
    const updated = [...questions];
    updated[qIndex].label = label;
    setQuestions(updated);
  };

  // Subquestion Handlers
  const handleAddSubquestion = (qIndex: number) => {
    const q = questions[qIndex];
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const nextLetter = letters[q.subquestions.length] || `s${q.subquestions.length + 1}`;

    const newSub: SubQuestionDef = {
      id: `sub_${nextLetter}_${Date.now().toString(36)}`,
      label: nextLetter,
      maxMarks: 5,
    };

    const updated = [...questions];
    updated[qIndex].subquestions.push(newSub);
    updated[qIndex].maxMarks = updated[qIndex].subquestions.reduce((sum, s) => sum + s.maxMarks, 0);
    setQuestions(updated);
  };

  const handleRemoveSubquestion = (qIndex: number, subIndex: number) => {
    const q = questions[qIndex];
    if (q.subquestions.length <= 1) {
      toast.error('Each question must have at least one subquestion.');
      return;
    }
    const updated = [...questions];
    updated[qIndex].subquestions = updated[qIndex].subquestions.filter((_, idx) => idx !== subIndex);
    updated[qIndex].maxMarks = updated[qIndex].subquestions.reduce((sum, s) => sum + s.maxMarks, 0);
    setQuestions(updated);
  };

  const handleUpdateSubquestion = (qIndex: number, subIndex: number, field: 'label' | 'maxMarks', val: any) => {
    const updated = [...questions];
    const sub = updated[qIndex].subquestions[subIndex];
    if (field === 'maxMarks') {
      const num = parseFloat(val) || 0;
      sub.maxMarks = Math.max(0, num);
    } else {
      sub.label = val;
    }
    updated[qIndex].maxMarks = updated[qIndex].subquestions.reduce((sum, s) => sum + s.maxMarks, 0);
    setQuestions(updated);
  };

  // Attempt Rules & Group Handlers
  const handleAddGroup = () => {
    const gNum = groups.length + 1;
    const newGroup: QuestionGroupRule = {
      id: `g${gNum}_${Date.now().toString(36)}`,
      name: `Group ${gNum} (Alternative Choice)`,
      questionIds: [],
      chooseType: 'BEST_OF_1',
      maxMarks: 25,
    };
    setGroups([...groups, newGroup]);
  };

  const handleRemoveGroup = (gIndex: number) => {
    setGroups(groups.filter((_, idx) => idx !== gIndex));
  };

  const handleToggleQuestionInGroup = (gIndex: number, qId: string) => {
    const updated = [...groups];
    const g = updated[gIndex];
    if (g.questionIds.includes(qId)) {
      g.questionIds = g.questionIds.filter((id) => id !== qId);
    } else {
      g.questionIds.push(qId);
    }
    setGroups(updated);
  };

  const handleUpdateGroup = (gIndex: number, field: keyof QuestionGroupRule, val: any) => {
    const updated = [...groups];
    (updated[gIndex] as any)[field] = val;
    setGroups(updated);
  };

  // Save Configuration Handler
  const handleSaveConfig = async (andContinue = false, confirmIncompatible = false) => {
    try {
      setSaving(true);
      const attemptRules: AttemptRulesDef = {
        type: attemptType,
        groups: attemptType === 'GROUPED_BEST_OF' ? groups : [],
      };

      const res = await facultyService.saveAssessmentConfig({
        subjectId,
        semester,
        assessmentType,
        maximumMarks,
        questionPattern: questions,
        attemptRules,
        confirmIncompatibleChange: confirmIncompatible,
        academicYear,
      });

      if (res.requiresConfirmation) {
        setIncompatibleWarning(res.message || 'Saving will invalidate existing marks. Confirm to proceed.');
        return;
      }

      toast.success('Question pattern configuration saved successfully.');
      setIncompatibleWarning(null);

      if (andContinue) {
        navigate(`/faculty/marks/grid?subjectId=${subjectId}&semester=${semester}&assessmentType=${assessmentType}`);
      } else {
        fetchConfig();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="h-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
        <div className="h-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* ── HEADER ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <button
              onClick={() => navigate(`/faculty/marks/semesters/${semester}`)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-200 border-2 border-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer mb-1"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
              <span>Back to Semester {semester} Subjects</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Settings className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                  Assessment Question Paper Pattern
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {config?.subjectCode} - {config?.subjectName} • Semester {semester} • AY {academicYear}
                </p>
              </div>
            </div>
          </div>

          {/* Assessment Switcher: CIE-1 vs CIE-2 */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => setAssessmentType('CIE1')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                assessmentType === 'CIE1'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              CIE-1
            </button>
            <button
              onClick={() => setAssessmentType('CIE2')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                assessmentType === 'CIE2'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              CIE-2
            </button>
          </div>
        </div>
      </div>

      {/* ── INCOMPATIBLE CHANGE WARNING MODAL / BANNER ── */}
      {incompatibleWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-2xl p-5 text-amber-900 dark:text-amber-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>Structural Change Confirmation</span>
          </div>
          <p className="text-xs">{incompatibleWarning}</p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleSaveConfig(false, true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Confirm and Overwrite Configuration
            </button>
            <button
              onClick={() => setIncompatibleWarning(null)}
              className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── GENERAL ASSESSMENT SETTINGS ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>1. Assessment Total & Attempt Scheme</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Maximum CIE Assessment Marks
            </label>
            <input
              type="number"
              value={maximumMarks}
              onChange={(e) => setMaximumMarks(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Question Paper Choice Pattern
            </label>
            <select
              value={attemptType}
              onChange={(e: any) => setAttemptType(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="GROUPED_BEST_OF">Configured Best-Of Groups (e.g. Q1 OR Q2, Q3 OR Q4)</option>
              <option value="COMPULSORY_ALL">Normal Compulsory (All questions compulsory)</option>
            </select>
          </div>
        </div>

        {/* Optional Copy CIE-1 Pattern Action for CIE-2 */}
        {assessmentType === 'CIE2' && (
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <Settings className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Optional: Reuse CIE-1 Pattern</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Optional: Reuse the CIE-1 question paper pattern. You can modify the copied structure before saving.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInitiateCopyCie1}
              disabled={loadingCie1}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all shadow-xs shrink-0"
            >
              <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{loadingCie1 ? 'Checking CIE-1...' : 'Copy CIE-1 Pattern'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── QUESTIONS & SUBQUESTIONS BUILDER ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>2. Main Questions & Subquestions Structure</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Define subquestions and maximum marks for each main question.
            </p>
          </div>

          <button
            onClick={handleAddQuestion}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-semibold text-xs border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Main Question</span>
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div
              key={q.id}
              className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {qIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => handleUpdateQuestionLabel(qIdx, e.target.value)}
                    className="w-24 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-900 dark:text-white"
                  />
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                    Total: <span className="text-blue-600 dark:text-blue-400">{q.maxMarks}M</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddSubquestion(qIdx)}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-900 text-blue-600 text-xs font-medium flex items-center gap-1"
                    title="Add subquestion"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Subquestion</span>
                  </button>
                  <button
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-red-50 text-red-600 text-xs"
                    title="Delete question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Subquestions Table / Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-2">
                {q.subquestions.map((sub, sIdx) => (
                  <div
                    key={sub.id}
                    className="p-2.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        {q.label}({sub.label})
                      </span>
                      {q.subquestions.length > 1 && (
                        <button
                          onClick={() => handleRemoveSubquestion(qIdx, sIdx)}
                          className="text-neutral-400 hover:text-red-600 text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={sub.maxMarks}
                        onChange={(e) => handleUpdateSubquestion(qIdx, sIdx, 'maxMarks', e.target.value)}
                        className="w-full px-2 py-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-900 dark:text-white"
                        placeholder="Marks"
                      />
                      <span className="text-xs font-medium text-neutral-500">M</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── GROUPED BEST-OF / OR RULES CONFIGURATION ── */}
      {attemptType === 'GROUPED_BEST_OF' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>3. Alternative Question Groups (OR Logic)</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Configure choice groups where the student receives the highest mark scored between questions (e.g. Q1 OR Q2).
              </p>
            </div>

            <button
              onClick={handleAddGroup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-semibold text-xs border border-purple-200 dark:border-purple-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add OR Group</span>
            </button>
          </div>

          <div className="space-y-3">
            {groups.map((grp, gIdx) => (
              <div
                key={grp.id}
                className="p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/30 dark:bg-purple-950/20 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={grp.name}
                      onChange={(e) => handleUpdateGroup(gIdx, 'name', e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-900 dark:text-white flex-1 max-w-sm"
                    />
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-neutral-500 font-medium">Max:</span>
                      <input
                        type="number"
                        value={grp.maxMarks}
                        onChange={(e) => handleUpdateGroup(gIdx, 'maxMarks', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-bold"
                      />
                      <span className="text-neutral-500">M</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveGroup(gIdx)}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-red-50 text-red-600 text-xs self-end"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Select Questions in this Group:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {questions.map((q) => {
                      const isSelected = grp.questionIds.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => handleToggleQuestionInGroup(gIdx, q.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                              : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-purple-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>{q.label} ({q.maxMarks}M)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PREVIEW SUMMARY ── */}
      <div className="bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
              Question Paper Layout Preview
            </span>
          </div>
          <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
            Total Target CIE: <span className="text-emerald-600 dark:text-emerald-400">{maximumMarks} Marks</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {questions.map((q) => (
            <div
              key={q.id}
              className="px-3 py-1.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center gap-2"
            >
              <span className="font-bold text-blue-600">{q.label}:</span>
              <span className="text-neutral-600 dark:text-neutral-400">
                {q.subquestions.map((s) => `${s.label}(${s.maxMarks}M)`).join(', ')} = {q.maxMarks}M
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM ACTIONS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
        <button
          onClick={() => handleSaveConfig(false)}
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-sm shadow-sm transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Save Draft Pattern</span>
        </button>

        <button
          onClick={() => handleSaveConfig(true)}
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all"
        >
          <span>Validate & Continue to Marks Grid</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      {/* ── COPY CIE-1 CONFIRMATION MODAL ── */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Copy CIE-1 Pattern?
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Optional Question Structure Reuse
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              This will copy only the CIE-1 question structure, subquestions, and marks distribution into CIE-2. You can freely modify the copied pattern before saving.
            </p>

            {questions.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>CIE-2 already has a configured pattern.</span>
                </p>
                <p>Copying CIE-1 will replace the current CIE-2 structure on this page.</p>
              </div>
            )}

            {config?.status === 'SAVED' && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3 text-[11px] text-red-800 dark:text-red-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  <span>CIE-2 contains saved marks.</span>
                </p>
                <p>Overwriting and saving a new pattern may reset marks that do not match the new subquestion layout.</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCopyCie1}
                disabled={loadingCie1}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{questions.length > 0 ? 'Replace with CIE-1 Pattern' : 'Copy Pattern'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyMarksConfigPage;
