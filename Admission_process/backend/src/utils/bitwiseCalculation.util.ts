import {
  MainQuestionDef,
  AttemptRulesDef,
  QuestionGroupRule,
} from '../models/AssessmentConfiguration';

export interface StudentSubquestionInput {
  questionId: string;
  subquestionId: string;
  marksObtained: number | null | string;
}

export interface CalculatedAssessmentResult {
  rawQuestionTotals: Record<string, number>;
  bestOfDetails: {
    groups: Array<{
      groupId: string;
      groupName: string;
      candidateQuestions: Array<{ questionId: string; total: number }>;
      selectedQuestionId: string | null;
      selectedMarks: number;
      maxMarks: number;
    }>;
    ungroupedQuestions: Array<{ questionId: string; total: number; maxMarks: number }>;
  };
  finalCieMarks: number;
  percentage: number;
  maxMarks: number;
  completionStatus: 'NOT_STARTED' | 'INCOMPLETE' | 'COMPLETED';
}

/**
 * Validates and normalizes numeric mark input
 * Returns null if blank/unentered, number if valid, throws error if invalid
 */
export function parseAndValidateMark(
  val: number | string | null | undefined,
  maxMarks: number,
  fieldLabel = 'Mark'
): number | null {
  if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
    return null;
  }

  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) {
    throw new Error(`${fieldLabel} must be a valid number.`);
  }

  if (num < 0) {
    throw new Error(`${fieldLabel} cannot be negative.`);
  }

  if (num > maxMarks) {
    throw new Error(`${fieldLabel} (${num}) exceeds maximum allowed marks (${maxMarks}).`);
  }

  // Round to 2 decimal places to prevent floating point inaccuracies
  return Math.round(num * 100) / 100;
}

/**
 * Calculates question-wise totals and best-of rule results for a student
 */
export function calculateStudentCieMarks(
  questions: MainQuestionDef[],
  attemptRules: AttemptRulesDef | undefined,
  assessmentMaxMarks: number,
  enteredMarks: Record<string, number | null> // key: `${questionId}___${subquestionId}`
): CalculatedAssessmentResult {
  const rawQuestionTotals: Record<string, number> = {};
  let totalSubquestionsCount = 0;
  let enteredSubquestionsCount = 0;

  // 1. Calculate question-level totals from subquestions
  for (const q of questions) {
    let qSum = 0;
    let anyAttemptedInQ = false;

    for (const sub of q.subquestions) {
      totalSubquestionsCount++;
      const key = `${q.id}___${sub.id}`;
      const mark = enteredMarks[key];

      if (mark !== null && mark !== undefined) {
        enteredSubquestionsCount++;
        anyAttemptedInQ = true;
        qSum += mark;
      }
    }

    // Cap question total at question maxMarks if configured
    const cappedQTotal = q.maxMarks > 0 ? Math.min(qSum, q.maxMarks) : qSum;
    rawQuestionTotals[q.id] = Math.round(cappedQTotal * 100) / 100;
  }

  // 2. Apply Group / Best-of / Compulsory logic
  const bestOfGroups: CalculatedAssessmentResult['bestOfDetails']['groups'] = [];
  const ungroupedQuestions: CalculatedAssessmentResult['bestOfDetails']['ungroupedQuestions'] = [];
  const groupedQuestionIds = new Set<string>();

  let finalCieSum = 0;

  if (attemptRules && attemptRules.type === 'GROUPED_BEST_OF' && Array.isArray(attemptRules.groups) && attemptRules.groups.length > 0) {
    for (const group of attemptRules.groups) {
      const candidates: Array<{ questionId: string; total: number }> = [];
      let bestQId: string | null = null;
      let highestMark = -1;

      for (const qId of group.questionIds) {
        groupedQuestionIds.add(qId);
        const qTotal = rawQuestionTotals[qId] ?? 0;
        candidates.push({ questionId: qId, total: qTotal });

        if (qTotal > highestMark) {
          highestMark = qTotal;
          bestQId = qId;
        }
      }

      const effectiveMark = Math.max(0, highestMark);
      const cappedGroupMark = group.maxMarks > 0 ? Math.min(effectiveMark, group.maxMarks) : effectiveMark;

      bestOfGroups.push({
        groupId: group.id,
        groupName: group.name,
        candidateQuestions: candidates,
        selectedQuestionId: bestQId,
        selectedMarks: cappedGroupMark,
        maxMarks: group.maxMarks,
      });

      finalCieSum += cappedGroupMark;
    }
  }

  // Any questions not part of a group contribute compulsorily
  for (const q of questions) {
    if (!groupedQuestionIds.has(q.id)) {
      const qTotal = rawQuestionTotals[q.id] ?? 0;
      ungroupedQuestions.push({
        questionId: q.id,
        total: qTotal,
        maxMarks: q.maxMarks,
      });
      finalCieSum += qTotal;
    }
  }

  // Final CIE total capped at assessment maxMarks
  const finalCieMarks = assessmentMaxMarks > 0 ? Math.min(finalCieSum, assessmentMaxMarks) : finalCieSum;
  const roundedFinal = Math.round(finalCieMarks * 100) / 100;
  const percentage = assessmentMaxMarks > 0 ? Math.round((roundedFinal / assessmentMaxMarks) * 10000) / 100 : 0;

  let completionStatus: 'NOT_STARTED' | 'INCOMPLETE' | 'COMPLETED' = 'NOT_STARTED';
  if (enteredSubquestionsCount === 0) {
    completionStatus = 'NOT_STARTED';
  } else if (enteredSubquestionsCount < totalSubquestionsCount) {
    completionStatus = 'INCOMPLETE';
  } else {
    completionStatus = 'COMPLETED';
  }

  return {
    rawQuestionTotals,
    bestOfDetails: {
      groups: bestOfGroups,
      ungroupedQuestions,
    },
    finalCieMarks: roundedFinal,
    percentage,
    maxMarks: assessmentMaxMarks,
    completionStatus,
  };
}

/**
 * Calculates Assignment raw and scaled totals
 */
export function calculateStudentAssignmentMarks(
  components: Array<{ id: string; label: string; maxMarks: number }>,
  maxMarks: number,
  policy: { type: 'SUM' | 'WEIGHTED_AVERAGE'; scaledMaxMarks?: number } | undefined,
  enteredMarks: Record<string, number | null> // key: componentId
): { rawTotal: number; scaledTotal: number; completionStatus: 'INCOMPLETE' | 'COMPLETED' } {
  let rawSum = 0;
  let enteredCount = 0;

  for (const comp of components) {
    const mark = enteredMarks[comp.id];
    if (mark !== null && mark !== undefined) {
      enteredCount++;
      rawSum += mark;
    }
  }

  const roundedRaw = Math.round(rawSum * 100) / 100;
  const scaledMax = policy?.scaledMaxMarks || maxMarks || 25;
  let scaledTotal = roundedRaw;

  if (maxMarks > 0 && scaledMax !== maxMarks) {
    scaledTotal = Math.round(((roundedRaw / maxMarks) * scaledMax) * 100) / 100;
  }

  const completionStatus = enteredCount === components.length ? 'COMPLETED' : 'INCOMPLETE';

  return {
    rawTotal: roundedRaw,
    scaledTotal: Math.min(scaledTotal, scaledMax),
    completionStatus,
  };
}

/**
 * Calculates Final Internal Marks given CIE-1, CIE-2, and Assignment results
 */
export function calculateFinalInternalMarks(
  cie1: number | null,
  cie2: number | null,
  assignmentScaled: number | null,
  policy: {
    cieRule?: 'AVERAGE' | 'BEST_OF';
    cieWeight?: number; // default 50
    assignmentWeight?: number; // default 25
    finalMaxMarks?: number; // default 50
    scalingFormula?: 'STANDARD_VTU_50' | 'DIRECT_SUM' | 'CUSTOM';
  } = {}
): {
  cieResult: number | null;
  cieScaled25: number | null;
  finalInternalMarks: number | null;
  status: 'INCOMPLETE' | 'READY';
} {
  const cieRule = policy.cieRule || 'AVERAGE';
  const finalMax = policy.finalMaxMarks || 50;

  // 1. Calculate CIE Result (out of 50M)
  let cieResult: number | null = null;
  if (cie1 !== null && cie2 !== null) {
    cieResult = cieRule === 'AVERAGE' 
      ? Math.round(((cie1 + cie2) / 2) * 100) / 100 
      : Math.max(cie1, cie2);
  } else if (cie1 !== null) {
    cieResult = cie1;
  } else if (cie2 !== null) {
    cieResult = cie2;
  }

  // 2. Calculate Scaled Down CIE to 25M (CIE Avg / 2)
  const cieScaled25: number | null = cieResult !== null 
    ? Math.round(((cieResult / 50) * 25) * 100) / 100 
    : null;

  // If either CIE is missing or assignment is missing
  if (cie1 === null || cie2 === null || assignmentScaled === null) {
    const partialFinal = (cieScaled25 !== null || assignmentScaled !== null)
      ? Math.min(Math.round((cieScaled25 || 0) + (assignmentScaled || 0)), finalMax)
      : null;

    return {
      cieResult,
      cieScaled25,
      finalInternalMarks: partialFinal,
      status: 'INCOMPLETE',
    };
  }

  // Final Internal Marks = Scaled Down CIE (25M) + Assignment (25M) => Max 50M (Whole number rounded off)
  let finalMarks = 0;
  if (policy.scalingFormula === 'DIRECT_SUM') {
    finalMarks = Math.min(Math.round((cieResult || 0) + assignmentScaled), finalMax);
  } else {
    // Default: Scaled Down CIE (25M) + Assignment (25M) = 50M (Rounded off to nearest whole integer)
    const combined = (cieScaled25 || 0) + assignmentScaled;
    finalMarks = Math.min(Math.round(combined), finalMax);
  }

  return {
    cieResult,
    cieScaled25,
    finalInternalMarks: finalMarks,
    status: 'READY',
  };
}

export interface VtuPassingCalculation {
  cieMarks: number | null;
  ciePassed: boolean;
  externalMarks: number | null;
  seeScaled50: number | null;
  seePassed: boolean;
  totalMarks: number | null;
  aggregatePassed: boolean;
  status: 'PASS' | 'FAIL' | 'NOT_ENTERED';
  reason?: string;
}

/**
 * Calculates student VTU Pass / Fail status based on Visvesvaraya Technological University (VTU) regulations:
 * 1. CIE (50M): Must score at least 40% (20 out of 50M) to be eligible and pass CIE.
 * 2. SEE (evaluated out of 100M, scaled to 50M):
 *    - Theory Courses: Must score at least 35% of SEE max marks (35 out of 100M, or 18 out of 50M).
 *    - Practical/Lab Courses: Must score at least 40% of SEE max marks (40 out of 100M, or 20 out of 50M).
 * 3. Combined Total Aggregate (100M):
 *    - Sum total of CIE (50M) + SEE scaled (50M) must be at least 40% (40 out of 100M).
 */
export function calculateVtuPassingStatus(
  finalCieMarks: number | null | undefined,
  rawExternalMarks: number | null | undefined,
  maxExternalMarks: number = 100,
  isLabOrPractical: boolean = false
): VtuPassingCalculation {
  const cie = finalCieMarks !== null && finalCieMarks !== undefined && !isNaN(Number(finalCieMarks))
    ? Number(finalCieMarks)
    : null;
  const ext = rawExternalMarks !== null && rawExternalMarks !== undefined && !isNaN(Number(rawExternalMarks))
    ? Number(rawExternalMarks)
    : null;

  // 1. Continuous Internal Evaluation (CIE) rule: Min 40% of 50M = 20M
  const ciePassed = cie !== null && cie >= 20;

  if (ext === null) {
    return {
      cieMarks: cie,
      ciePassed,
      externalMarks: null,
      seeScaled50: null,
      seePassed: false,
      totalMarks: cie,
      aggregatePassed: false,
      status: 'NOT_ENTERED',
      reason: !ciePassed && cie !== null ? 'CIE < 20 (Not eligible for SEE)' : undefined,
    };
  }

  // 2. Semester End Examination (SEE) rule:
  // Theory: Min 35% of SEE max marks (35/100, or 18/50)
  // Lab / Practical: Min 40% of SEE max marks (40/100, or 20/50)
  const maxExt = maxExternalMarks > 0 ? maxExternalMarks : 100;
  const seePercentage = (ext / maxExt) * 100;
  const seeScaled50 = Math.round(((ext / maxExt) * 50) * 100) / 100;

  const minSeePct = isLabOrPractical ? 40 : 35;
  const minRawMarks = isLabOrPractical ? (0.40 * maxExt) : (0.35 * maxExt);
  const seePassed = ext >= minRawMarks || seePercentage >= minSeePct;

  // 3. Combined Total Aggregate rule:
  // CIE (50M) + SEE scaled (50M) must be >= 40% of 100M = 40M
  const totalMarks = cie !== null ? Math.round((cie + seeScaled50) * 100) / 100 : seeScaled50;
  const aggregatePassed = totalMarks >= 40;

  const isPassed = ciePassed && seePassed && aggregatePassed;

  const reasons: string[] = [];
  if (!ciePassed) {
    reasons.push(`CIE < 20 (${cie !== null ? Math.round(cie) : 0}/50)`);
  }
  if (!seePassed) {
    reasons.push(`SEE < ${minSeePct}% (${ext}/${maxExt})`);
  }
  if (!aggregatePassed) {
    reasons.push(`Total < 40 (${totalMarks}/100)`);
  }

  return {
    cieMarks: cie,
    ciePassed,
    externalMarks: ext,
    seeScaled50,
    seePassed,
    totalMarks,
    aggregatePassed,
    status: isPassed ? 'PASS' : 'FAIL',
    reason: reasons.length > 0 ? reasons.join(' • ') : undefined,
  };
}
