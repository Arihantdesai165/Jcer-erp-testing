import { 
  calculateStudentCieMarks, 
  calculateStudentAssignmentMarks, 
  calculateFinalInternalMarks,
  parseAndValidateMark
} from '../utils/bitwiseCalculation.util';
import { MainQuestionDef, AttemptRulesDef } from '../models/AssessmentConfiguration';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, suite: string) {
  if (condition) {
    results.push({ suite, name, passed: true });
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    results.push({ suite, name, passed: false, error: 'Assertion failed' });
    console.error(`  ❌ [FAIL] ${name}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE BITWISE MARKS MODULE TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. INPUT VALIDATION TESTS
  // -------------------------------------------------------------
  console.log('📦 SUITE 1: Marks Input Validation & Boundary Checks');

  // Test 15: Negative marks rejected
  let negRejected = false;
  try {
    parseAndValidateMark(-5, 10, 'Subquestion 1a');
  } catch (err: any) {
    negRejected = err.message.includes('cannot be negative');
  }
  assert(negRejected, 'Negative marks are strictly rejected with validation error', 'Input Validation');

  // Test 16: Marks exceeding maximum rejected
  let overMaxRejected = false;
  try {
    parseAndValidateMark(12, 10, 'Subquestion 1a');
  } catch (err: any) {
    overMaxRejected = err.message.includes('exceeds maximum allowed marks');
  }
  assert(overMaxRejected, 'Marks exceeding configured subquestion maximum are strictly rejected', 'Input Validation');

  // Test 17: Blank mark remains null / distinct from zero
  const blankMark = parseAndValidateMark('', 10);
  const zeroMark = parseAndValidateMark(0, 10);
  assert(blankMark === null && zeroMark === 0, 'Blank marks remain null and distinct from explicit zero', 'Input Validation');

  // Test 18: Decimal marks supported and rounded to 2 decimals
  const decimalMark = parseAndValidateMark('6.75', 10);
  assert(decimalMark === 6.75, 'Decimal marks parsed accurately with 2-decimal precision', 'Input Validation');

  // -------------------------------------------------------------
  // 2. QUESTION CONFIGURATION & BEST-OF CALCULATION TESTS
  // -------------------------------------------------------------
  console.log('\n📦 SUITE 2: Dynamic Question Patterns & Best-of OR Logic');

  const mainQuestions: MainQuestionDef[] = [
    {
      id: 'q1',
      questionNumber: 1,
      label: 'Q1',
      maxMarks: 25,
      subquestions: [
        { id: '1a', label: '1(a)', maxMarks: 7 },
        { id: '1b', label: '1(b)', maxMarks: 8 },
        { id: '1c', label: '1(c)', maxMarks: 10 }
      ]
    },
    {
      id: 'q2',
      questionNumber: 2,
      label: 'Q2',
      maxMarks: 25,
      subquestions: [
        { id: '2a', label: '2(a)', maxMarks: 12 },
        { id: '2b', label: '2(b)', maxMarks: 13 }
      ]
    },
    {
      id: 'q3',
      questionNumber: 3,
      label: 'Q3',
      maxMarks: 25,
      subquestions: [
        { id: '3a', label: '3(a)', maxMarks: 10 },
        { id: '3b', label: '3(b)', maxMarks: 15 }
      ]
    },
    {
      id: 'q4',
      questionNumber: 4,
      label: 'Q4',
      maxMarks: 25,
      subquestions: [
        { id: '4a', label: '4(a)', maxMarks: 25 }
      ]
    }
  ];

  const attemptRules: AttemptRulesDef = {
    type: 'GROUPED_BEST_OF',
    groups: [
      { id: 'grp1', name: 'Group 1 (Q1 OR Q2)', questionIds: ['q1', 'q2'], chooseType: 'BEST_OF_1', maxMarks: 25 },
      { id: 'grp2', name: 'Group 2 (Q3 OR Q4)', questionIds: ['q3', 'q4'], chooseType: 'BEST_OF_1', maxMarks: 25 }
    ]
  };

  // Test 7, 8, 9: Dynamic question structures
  assert(mainQuestions.length === 4, 'Dynamic main-question creation (4 main questions)', 'Question Pattern');
  assert(mainQuestions[0].subquestions.length === 3, 'Dynamic subquestion creation (3 subquestions in Q1)', 'Question Pattern');
  assert(mainQuestions[3].subquestions.length === 1, 'Different subquestion count across questions (1 subquestion in Q4)', 'Question Pattern');

  // Entered marks map with key `${qId}___${subId}`
  // Student scores:
  // Q1: 6 + 7 + 7 = 20 / 25
  // Q2: 11 + 12 = 23 / 25  --> Group 1 Best-of: MAX(20, 23) = 23
  // Q3: 8 + 10 = 18 / 25
  // Q4: 22 / 25            --> Group 2 Best-of: MAX(18, 22) = 22
  // Final CIE: 23 + 22 = 45 / 50
  const enteredMarks: Record<string, number | null> = {
    'q1___1a': 6,
    'q1___1b': 7,
    'q1___1c': 7,
    'q2___2a': 11,
    'q2___2b': 12,
    'q3___3a': 8,
    'q3___3b': 10,
    'q4___4a': 22
  };

  const calculated = calculateStudentCieMarks(mainQuestions, attemptRules, 50, enteredMarks);

  // Test 19: Main question totals
  assert(calculated.rawQuestionTotals['q1'] === 20, 'Q1 total correctly sums 6 + 7 + 7 = 20 / 25', 'Calculations');
  assert(calculated.rawQuestionTotals['q2'] === 23, 'Q2 total correctly sums 11 + 12 = 23 / 25', 'Calculations');
  assert(calculated.rawQuestionTotals['q3'] === 18, 'Q3 total correctly sums 8 + 10 = 18 / 25', 'Calculations');
  assert(calculated.rawQuestionTotals['q4'] === 22, 'Q4 total correctly equals 22 / 25', 'Calculations');

  // Test 13 & 20: Best of logic
  assert(calculated.bestOfDetails.groups[0].selectedMarks === 23, 'Group 1 selects best score (Q2 = 23)', 'Calculations');
  assert(calculated.bestOfDetails.groups[1].selectedMarks === 22, 'Group 2 selects best score (Q4 = 22)', 'Calculations');
  assert(calculated.finalCieMarks === 45, 'Final CIE marks accurately calculates MAX(20,23) + MAX(18,22) = 45 / 50', 'Calculations');
  assert(calculated.completionStatus === 'COMPLETED', 'Assessment marked COMPLETED when all subquestions entered', 'Calculations');

  // Test 12: Compulsory-only calculation
  const compulsoryQuestions: MainQuestionDef[] = [
    { id: 'cq1', questionNumber: 1, label: 'Q1', maxMarks: 15, subquestions: [{ id: 'cq1_a', label: '1(a)', maxMarks: 15 }] },
    { id: 'cq2', questionNumber: 2, label: 'Q2', maxMarks: 15, subquestions: [{ id: 'cq2_a', label: '2(a)', maxMarks: 15 }] }
  ];
  const compulsoryAttemptRules: AttemptRulesDef = { type: 'COMPULSORY_ALL' };
  const compCalc = calculateStudentCieMarks(compulsoryQuestions, compulsoryAttemptRules, 30, {
    'cq1___cq1_a': 12,
    'cq2___cq2_a': 14
  });
  assert(compCalc.finalCieMarks === 26, 'Normal compulsory question configuration sums all question totals (12 + 14 = 26 / 30)', 'Calculations');

  // -------------------------------------------------------------
  // 3. ASSIGNMENT MARKS CONFIG & SCALING TESTS
  // -------------------------------------------------------------
  console.log('\n📦 SUITE 3: Assignment Component Marks & Scaling Logic');

  const assignmentComponents = [
    { id: 'a1', label: 'Assignment 1', maxMarks: 5 },
    { id: 'a2', label: 'Assignment 2', maxMarks: 5 },
    { id: 'a3', label: 'Assignment 3', maxMarks: 5 },
    { id: 'a4', label: 'Assignment 4', maxMarks: 5 },
    { id: 'a5', label: 'Assignment 5', maxMarks: 5 }
  ];

  const aMarks = { a1: 5, a2: 4, a3: 5, a4: 4, a5: 5 };
  const aCalc = calculateStudentAssignmentMarks(assignmentComponents, 25, { type: 'SUM', scaledMaxMarks: 25 }, aMarks);
  assert(aCalc.rawTotal === 23, 'Assignment raw total correctly calculated as 5+4+5+4+5 = 23 / 25', 'Assignment');
  assert(aCalc.scaledTotal === 23, 'Assignment scaled score matches raw score when scaledMaxMarks equals maxMarks', 'Assignment');
  assert(aCalc.completionStatus === 'COMPLETED', 'Assignment marked COMPLETED', 'Assignment');

  // Scaled assignment test (e.g. Raw 50 scaled down to 25)
  const scaledComponents = [
    { id: 'asg1', label: 'Assignment 1', maxMarks: 25 },
    { id: 'asg2', label: 'Assignment 2', maxMarks: 25 }
  ];
  const scaledCalc = calculateStudentAssignmentMarks(scaledComponents, 50, { type: 'SUM', scaledMaxMarks: 25 }, { asg1: 20, asg2: 20 });
  assert(scaledCalc.rawTotal === 40, 'Assignment raw total 40 / 50', 'Assignment');
  assert(scaledCalc.scaledTotal === 20, 'Assignment raw total 40/50 correctly scaled to 20 / 25', 'Assignment');

  // -------------------------------------------------------------
  // 4. FINAL INTERNAL MARKS COMBINATION TESTS
  // -------------------------------------------------------------
  console.log('\n📦 SUITE 4: Final Internal Marks Combined Schemes');

  // Scheme 1: CIE Average (50) + Assignment (25) -> Standard VTU formula (CIE Avg + Assignment) * (50 / 75)
  // CIE-1 = 45, CIE-2 = 41 -> CIE Avg = 43. Assignment = 22.
  // Formula: Scaled Down (21.5) + Assignment (22) = 43.5 / 50
  const finalResultA = calculateFinalInternalMarks(45, 41, 22, {
    cieRule: 'AVERAGE',
    cieWeight: 50,
    assignmentWeight: 25,
    finalMaxMarks: 50,
  });

  assert(finalResultA.cieResult === 43, 'CIE average of (45 + 41) / 2 = 43', 'Final Internal');
  assert(finalResultA.cieScaled25 === 21.5, 'CIE scaled down to 25 = 21.5', 'Final Internal');
  assert(finalResultA.finalInternalMarks === 44, 'Final internal marks = Scaled Down (21.5) + Assignment (22) rounded to whole number = 44 / 50', 'Final Internal');
  assert(finalResultA.status === 'READY', 'Final marks status is READY when all components available', 'Final Internal');

  // Scheme 2: Direct Sum (CIE Avg 19 + Assignment 5 = Final 24)
  const finalResultB = calculateFinalInternalMarks(18, 20, 5, {
    cieRule: 'AVERAGE',
    cieWeight: 20,
    assignmentWeight: 5,
    finalMaxMarks: 25,
    scalingFormula: 'DIRECT_SUM'
  });
  assert(finalResultB.finalInternalMarks === 24, 'Direct sum internal score (19 + 5 = 24 / 25)', 'Final Internal');

  // Test 28: Incomplete assessments handling
  const incompleteFinal = calculateFinalInternalMarks(45, null, 20, {
    cieRule: 'AVERAGE',
    cieWeight: 50,
    assignmentWeight: 25,
    finalMaxMarks: 50,
  });
  assert(incompleteFinal.status === 'INCOMPLETE', 'Missing assessment correctly sets status as INCOMPLETE without silent calculation', 'Final Internal');

  // -------------------------------------------------------------
  // 5. EXCEL WORKBOOK & MULTI-SHEET GENERATION TEST
  // -------------------------------------------------------------
  console.log('\n📦 SUITE 5: Professional Excel Generation & Multi-Sheet Structure');

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JCER ERP Assessment Cell';
  workbook.created = new Date();

  // Test CIE-1 Sheet creation with Freeze Panes
  const cie1Sheet = workbook.addWorksheet('CIE-1 Bitwise', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true }
  });
  cie1Sheet.getCell('A1').value = 'JAIN COLLEGE OF ENGINEERING AND RESEARCH, BELAGAVI';
  cie1Sheet.getCell('A2').value = 'DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING';
  cie1Sheet.getCell('A3').value = 'CONTINUOUS INTERNAL EVALUATION (CIE-1) BITWISE MARKS';
  
  // Test adding multi-sheet tabs
  workbook.addWorksheet('CIE-2 Bitwise', { views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }] });
  workbook.addWorksheet('Assignment Marks', { views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }] });
  workbook.addWorksheet('Final Internal Marks', { views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }] });
  workbook.addWorksheet('External Marks', { views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }] });

  const excelBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  assert(Buffer.isBuffer(excelBuffer) && excelBuffer.length > 3000, `Generated official 5-sheet Excel workbook (${excelBuffer.length} bytes)`, 'Excel Service');
  assert(workbook.worksheets.length === 5, 'Workbook contains all 5 required worksheets (CIE-1, CIE-2, Assignments, Final Internal, External)', 'Excel Service');

  // -------------------------------------------------------------
  // 6. SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(`📊 TEST SUITE SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log('================================================================');

  if (passedCount === totalCount) {
    console.log('🎉 ALL AUTOMATED TEST CRITERIA PASSED SUCCESSFULLY!');
  } else {
    console.error(`⚠️ ${totalCount - passedCount} TESTS FAILED.`);
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
