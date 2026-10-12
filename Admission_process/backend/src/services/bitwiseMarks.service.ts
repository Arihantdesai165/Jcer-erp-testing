import { Op, Transaction } from 'sequelize';
import db from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import Department from '../models/Department';
import Student from '../models/Student';
import User from '../models/User';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import AssessmentConfiguration, {
  MainQuestionDef,
  AttemptRulesDef,
} from '../models/AssessmentConfiguration';
import StudentQuestionMarks from '../models/StudentQuestionMarks';
import StudentAssessmentSummary from '../models/StudentAssessmentSummary';
import AssignmentConfiguration, {
  AssignmentComponentDef,
} from '../models/AssignmentConfiguration';
import StudentAssignmentMarks from '../models/StudentAssignmentMarks';
import StudentAssignmentSummary from '../models/StudentAssignmentSummary';
import FinalInternalMarks from '../models/FinalInternalMarks';
import ExternalExaminationMarks from '../models/ExternalExaminationMarks';
import {
  parseAndValidateMark,
  calculateStudentCieMarks,
  calculateStudentAssignmentMarks,
  calculateFinalInternalMarks,
  calculateVtuPassingStatus,
} from '../utils/bitwiseCalculation.util';
import bitwiseMarksExcelService from './bitwiseMarksExcel.service';
import bitwiseMarksBackupQueueService from './bitwiseMarksBackupQueue.service';
import logger from '../utils/logger.util';

/**
 * Normalizes academic year string variants
 */
const normalizeAY = (ay?: string): string => {
  if (!ay) return '2026-27';
  const clean = ay.trim().replace(/\u2013|\u2014/g, '-');
  const match = clean.match(/^(\d{4})-\d{2}(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return clean;
};

const getAYVariants = (ay?: string): string[] => {
  const base = normalizeAY(ay);
  const variants = new Set<string>([base]);
  const match = base.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const fullEnd = `20${match[2]}`;
    variants.add(`${match[1]}-${fullEnd}`);
    variants.add(`${match[1]}\u2013${fullEnd}`);
    variants.add(`${match[1]}\u2013${match[2]}`);
  }
  return Array.from(variants);
};

export const bitwiseMarksService = {
  /**
   * 1. Authorization check helper: Ensures faculty is assigned to this subject & semester
   */
  async verifyFacultySubjectAuthorization(
    userId: string,
    subjectId: string,
    semester: number,
    academicYear?: string
  ): Promise<{ assignment: FacultyAssignment; departmentId: string }> {
    const ayVariants = getAYVariants(academicYear);

    const assignment = await FacultyAssignment.findOne({
      where: {
        userId,
        subjectId,
        semester,
        academicYear: { [Op.in]: ayVariants },
        status: 'ACTIVE',
      },
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (!assignment) {
      // Also check if user is HOD/ADMIN or assigned in department
      const user = await User.findByPk(userId);
      if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'HOD')) {
        const subject = await Subject.findByPk(subjectId);
        if (!subject) throw new Error('Subject not found.');
        return {
          assignment: {
            id: 'ADMIN_OVERRIDE',
            userId,
            subjectId,
            semester,
            departmentId: subject.departmentId || (user as any).departmentId || '',
            academicYear: normalizeAY(academicYear),
            subject,
          } as any,
          departmentId: subject.departmentId || (user as any).departmentId || '',
        };
      }
      throw new Error(`Unauthorized: You are not assigned to subject (${subjectId}) for Semester ${semester}.`);
    }

    return {
      assignment,
      departmentId: assignment.departmentId,
    };
  },

  /**
   * 2. PAGE 1: Fetch authorized semesters for faculty with real progress stats
   */
  async getAuthorizedSemesters(userId: string, academicYear?: string) {
    const ayVariants = getAYVariants(academicYear);
    const cleanAY = normalizeAY(academicYear);

    const assignments = await FacultyAssignment.findAll({
      where: {
        userId,
        academicYear: { [Op.in]: ayVariants },
        status: 'ACTIVE',
      },
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
      order: [['semester', 'ASC']],
    });

    // Group assignments by semester
    const semesterMap: Record<number, {
      semester: number;
      departmentId: string;
      departmentName: string;
      departmentCode: string;
      subjects: Array<{ id: string; name: string; code: string }>;
    }> = {};

    for (const a of assignments) {
      if (!semesterMap[a.semester]) {
        semesterMap[a.semester] = {
          semester: a.semester,
          departmentId: a.departmentId,
          departmentName: (a as any).department?.name || 'Department',
          departmentCode: (a as any).department?.code || 'CSE',
          subjects: [],
        };
      }
      if (a.subjectId && !semesterMap[a.semester].subjects.some((s) => s.id === a.subjectId)) {
        semesterMap[a.semester].subjects.push({
          id: a.subjectId,
          name: (a as any).subject?.name || 'Assigned Subject',
          code: (a as any).subject?.code || 'SUB001',
        });
      }
    }

    const semesterCards: any[] = [];

    for (const sem of Object.values(semesterMap)) {
      const subjectIds = sem.subjects.map((s) => s.id);

      // Fetch configs and completion stats for these subjects
      const cie1Configs = await AssessmentConfiguration.findAll({
        where: {
          academicYear: { [Op.in]: ayVariants },
          departmentId: sem.departmentId,
          semester: sem.semester,
          subjectId: { [Op.in]: subjectIds },
          assessmentType: 'CIE1',
        },
      });

      const cie2Configs = await AssessmentConfiguration.findAll({
        where: {
          academicYear: { [Op.in]: ayVariants },
          departmentId: sem.departmentId,
          semester: sem.semester,
          subjectId: { [Op.in]: subjectIds },
          assessmentType: 'CIE2',
        },
      });

      const assignmentConfigs = await AssignmentConfiguration.findAll({
        where: {
          academicYear: { [Op.in]: ayVariants },
          departmentId: sem.departmentId,
          semester: sem.semester,
          subjectId: { [Op.in]: subjectIds },
        },
      });

      const finalMarks = await FinalInternalMarks.findAll({
        where: {
          academicYear: { [Op.in]: ayVariants },
          departmentId: sem.departmentId,
          semester: sem.semester,
          subjectId: { [Op.in]: subjectIds },
        },
      });

      let cie1Status = 'Not Configured';
      if (cie1Configs.length > 0) {
        const hasSaved = cie1Configs.some((c) => c.status === 'SAVED' || c.status === 'CONFIGURED');
        cie1Status = hasSaved ? 'Saved' : 'Draft';
      }

      let cie2Status = 'Not Configured';
      if (cie2Configs.length > 0) {
        const hasSaved = cie2Configs.some((c) => c.status === 'SAVED' || c.status === 'CONFIGURED');
        cie2Status = hasSaved ? 'Saved' : 'Draft';
      }

      let assignmentStatus = 'Not Configured';
      if (assignmentConfigs.length > 0) {
        assignmentStatus = 'Saved';
      }

      let finalInternalStatus = 'Not Started';
      if (finalMarks.length > 0) {
        const isFinalized = finalMarks.some((f) => f.status === 'FINALIZED');
        finalInternalStatus = isFinalized ? 'Finalized' : 'Draft';
      }

      semesterCards.push({
        semester: sem.semester,
        semesterName: `Semester ${sem.semester}`,
        departmentId: sem.departmentId,
        departmentName: sem.departmentName,
        departmentCode: sem.departmentCode,
        academicYear: cleanAY,
        assignedSubjectsCount: sem.subjects.length,
        configsCompletedCount: cie1Configs.length + cie2Configs.length + assignmentConfigs.length,
        cie1Status,
        cie2Status,
        assignmentStatus,
        finalInternalStatus,
      });
    }

    return semesterCards;
  },

  /**
   * 3. PAGE 2: Fetch subjects for a semester with status for each assessment
   */
  async getAuthorizedSubjectsForSemester(userId: string, semester: number, academicYear?: string) {
    const ayVariants = getAYVariants(academicYear);
    const cleanAY = normalizeAY(academicYear);

    const assignments = await FacultyAssignment.findAll({
      where: {
        userId,
        semester,
        academicYear: { [Op.in]: ayVariants },
        status: 'ACTIVE',
      },
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    const user = await User.findByPk(userId);
    const facultyName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Faculty';

    const subjectMap: Record<string, any> = {};

    for (const a of assignments) {
      if (!a.subjectId) continue;
      if (!subjectMap[a.subjectId]) {
        subjectMap[a.subjectId] = {
          subjectId: a.subjectId,
          subjectCode: (a as any).subject?.code || 'SUB001',
          subjectName: (a as any).subject?.name || 'Assigned Subject',
          departmentId: a.departmentId,
          departmentName: (a as any).department?.name || 'Department',
          departmentCode: (a as any).department?.code || 'CSE',
          semester,
          academicYear: cleanAY,
          assignedFaculty: facultyName,
          cie1Status: 'Not Configured',
          cie2Status: 'Not Configured',
          assignmentStatus: 'Not Configured',
          finalInternalStatus: 'Not Started',
          syncStatus: 'NOT_CONFIGURED',
        };
      }
    }

    // Enhance each subject with real status from DB
    for (const sId of Object.keys(subjectMap)) {
      const item = subjectMap[sId];

      const cie1 = await AssessmentConfiguration.findOne({
        where: { academicYear: { [Op.in]: ayVariants }, departmentId: item.departmentId, semester, subjectId: sId, assessmentType: 'CIE1' },
      });
      if (cie1) {
        const hasMarks = await StudentQuestionMarks.count({ where: { assessmentConfigurationId: cie1.id } });
        item.cie1Status = hasMarks > 0 ? (cie1.status === 'SAVED' ? 'Saved' : 'Marks In Progress') : 'Configured';
      }

      const cie2 = await AssessmentConfiguration.findOne({
        where: { academicYear: { [Op.in]: ayVariants }, departmentId: item.departmentId, semester, subjectId: sId, assessmentType: 'CIE2' },
      });
      if (cie2) {
        const hasMarks = await StudentQuestionMarks.count({ where: { assessmentConfigurationId: cie2.id } });
        item.cie2Status = hasMarks > 0 ? (cie2.status === 'SAVED' ? 'Saved' : 'Marks In Progress') : 'Configured';
      }

      const assignConfig = await AssignmentConfiguration.findOne({
        where: { academicYear: { [Op.in]: ayVariants }, departmentId: item.departmentId, semester, subjectId: sId },
      });
      if (assignConfig) {
        const hasAssignMarks = await StudentAssignmentMarks.count({ where: { assignmentConfigurationId: assignConfig.id } });
        item.assignmentStatus = hasAssignMarks > 0 ? 'Saved' : 'Configured';
      }

      const finalCount = await FinalInternalMarks.count({
        where: { academicYear: { [Op.in]: ayVariants }, departmentId: item.departmentId, semester, subjectId: sId },
      });
      if (finalCount > 0) {
        const isFinalized = await FinalInternalMarks.findOne({
          where: { academicYear: { [Op.in]: ayVariants }, departmentId: item.departmentId, semester, subjectId: sId, status: 'FINALIZED' },
        });
        item.finalInternalStatus = isFinalized ? 'Finalized' : 'Saved';
      }

      const driveStatus = await bitwiseMarksBackupQueueService.getSubjectSyncStatus(sId, semester, cleanAY);
      item.syncStatus = driveStatus.status;
    }

    return Object.values(subjectMap);
  },

  /**
   * 4. Consolidated student roster query for department, semester & academic year
   * CRITICAL: No section partitioning, single canonical list sorted by USN
   */
  async getConsolidatedStudentRoster(
    departmentId: string,
    semester: number,
    academicYear?: string
  ): Promise<any[]> {
    const ayVariants = getAYVariants(academicYear);

    // 1. Direct Student query for department & semester
    const studentsDirect = await Student.findAll({
      where: {
        departmentId,
        semester,
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
      order: [['usn', 'ASC'], ['enrollmentNumber', 'ASC']],
    });

    // 2. Also check StudentAcademicEnrollment for any enrolled students in this academic context
    const enrollments = await StudentAcademicEnrollment.findAll({
      where: {
        departmentId,
        semesterId: semester,
        academicYearId: { [Op.in]: ayVariants },
        status: 'ACTIVE',
      },
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
            { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
          ],
        },
      ],
    });

    // Merge and deduplicate by Student ID
    const studentMap = new Map<string, any>();

    for (const s of studentsDirect) {
      studentMap.set(s.id, {
        id: s.id,
        usn: s.usn || s.enrollmentNumber || 'N/A',
        enrollmentNumber: s.enrollmentNumber,
        rollNumber: s.rollNumber,
        studentName: s.user ? `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() : 'Student',
        email: s.user?.email || '',
        section: s.section || 'A',
        semester: s.semester,
        departmentId: s.departmentId,
        departmentCode: s.department?.code || 'CSE',
      });
    }

    for (const e of enrollments) {
      if (e.student && !studentMap.has(e.student.id)) {
        const s = e.student;
        studentMap.set(s.id, {
          id: s.id,
          usn: s.usn || s.enrollmentNumber || 'N/A',
          enrollmentNumber: s.enrollmentNumber,
          rollNumber: s.rollNumber,
          studentName: s.user ? `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() : 'Student',
          email: s.user?.email || '',
          section: s.section || 'A',
          semester: s.semester,
          departmentId: s.departmentId,
          departmentCode: s.department?.code || 'CSE',
        });
      }
    }

    const consolidatedList = Array.from(studentMap.values());

    // Sort deterministically by USN ascending, fallback to enrollmentNumber / Name
    consolidatedList.sort((a, b) => {
      const usnA = (a.usn || '').trim().toUpperCase();
      const usnB = (b.usn || '').trim().toUpperCase();
      if (usnA && usnB && usnA !== 'N/A' && usnB !== 'N/A') {
        return usnA.localeCompare(usnB);
      }
      return (a.studentName || '').localeCompare(b.studentName || '');
    });

    return consolidatedList;
  },

  /**
   * 5. PAGE 3: Get Assessment Configuration (CIE-1 or CIE-2)
   */
  async getAssessmentConfiguration(
    userId: string,
    subjectId: string,
    semester: number,
    assessmentType: 'CIE1' | 'CIE2',
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);

    const config = await AssessmentConfiguration.findOne({
      where: {
        academicYear: { [Op.in]: ayVariants },
        departmentId,
        semester,
        subjectId,
        assessmentType,
      },
    });

    const subject = await Subject.findByPk(subjectId);
    const department = await Department.findByPk(departmentId);

    // Default question pattern: 4 questions of 25 marks (a:6, b:7, c:6, d:6) with Q1 OR Q2, Q3 OR Q4
    const defaultPattern: MainQuestionDef[] = [
      {
        id: 'q1',
        questionNumber: 1,
        label: 'Q1',
        maxMarks: 25,
        subquestions: [
          { id: 'q1_a', label: 'a', maxMarks: 6 },
          { id: 'q1_b', label: 'b', maxMarks: 7 },
          { id: 'q1_c', label: 'c', maxMarks: 6 },
          { id: 'q1_d', label: 'd', maxMarks: 6 },
        ],
      },
      {
        id: 'q2',
        questionNumber: 2,
        label: 'Q2',
        maxMarks: 25,
        subquestions: [
          { id: 'q2_a', label: 'a', maxMarks: 6 },
          { id: 'q2_b', label: 'b', maxMarks: 7 },
          { id: 'q2_c', label: 'c', maxMarks: 6 },
          { id: 'q2_d', label: 'd', maxMarks: 6 },
        ],
      },
      {
        id: 'q3',
        questionNumber: 3,
        label: 'Q3',
        maxMarks: 25,
        subquestions: [
          { id: 'q3_a', label: 'a', maxMarks: 6 },
          { id: 'q3_b', label: 'b', maxMarks: 7 },
          { id: 'q3_c', label: 'c', maxMarks: 6 },
          { id: 'q3_d', label: 'd', maxMarks: 6 },
        ],
      },
      {
        id: 'q4',
        questionNumber: 4,
        label: 'Q4',
        maxMarks: 25,
        subquestions: [
          { id: 'q4_a', label: 'a', maxMarks: 6 },
          { id: 'q4_b', label: 'b', maxMarks: 7 },
          { id: 'q4_c', label: 'c', maxMarks: 6 },
          { id: 'q4_d', label: 'd', maxMarks: 6 },
        ],
      },
    ];

    const defaultAttemptRules: AttemptRulesDef = {
      type: 'GROUPED_BEST_OF',
      groups: [
        {
          id: 'g1',
          name: 'Group 1 (Q1 OR Q2)',
          questionIds: ['q1', 'q2'],
          chooseType: 'BEST_OF_1',
          maxMarks: 25,
        },
        {
          id: 'g2',
          name: 'Group 2 (Q3 OR Q4)',
          questionIds: ['q3', 'q4'],
          chooseType: 'BEST_OF_1',
          maxMarks: 25,
        },
      ],
    };

    let hasExistingMarks = false;
    let existingMarksCount = 0;
    if (config) {
      existingMarksCount = await StudentQuestionMarks.count({
        where: { assessmentConfigurationId: config.id },
      });
      hasExistingMarks = existingMarksCount > 0;
    }

    return {
      id: config?.id || null,
      departmentId,
      departmentName: department?.name || 'Department',
      departmentCode: department?.code || 'CSE',
      semester,
      academicYear: cleanAY,
      subjectId,
      subjectCode: subject?.code || 'SUB001',
      subjectName: subject?.name || 'Assigned Subject',
      assessmentType,
      maximumMarks: config?.maximumMarks !== undefined ? Number(config.maximumMarks) : 50,
      questionPattern: config?.questionPattern || defaultPattern,
      attemptRules: config?.attemptRules || defaultAttemptRules,
      configurationVersion: config?.configurationVersion || 1,
      status: config?.status || 'DRAFT',
      workflowStatus: config?.status || 'DRAFT',
      assignedHodId: config?.assignedHodId || null,
      hodReviewComment: config?.hodReviewComment || null,
      reviewedAt: config?.reviewedAt || null,
      approvedAt: config?.approvedAt || null,
      isPublished: config?.isPublished || false,
      publishedAt: config?.publishedAt || null,
      submissionCount: config?.submissionCount || 0,
      hasExistingMarks,
      existingMarksCount,
    };
  },

  /**
   * 6. Save/Update Assessment Configuration
   */
  async saveAssessmentConfiguration(
    userId: string,
    subjectId: string,
    semester: number,
    assessmentType: 'CIE1' | 'CIE2',
    payload: {
      maximumMarks: number;
      questionPattern: MainQuestionDef[];
      attemptRules: AttemptRulesDef;
      confirmIncompatibleChange?: boolean;
    },
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);

    // Validate questions and subquestions
    if (!Array.isArray(payload.questionPattern) || payload.questionPattern.length === 0) {
      throw new Error('At least one main question is required.');
    }

    for (let i = 0; i < payload.questionPattern.length; i++) {
      const q = payload.questionPattern[i];
      if (!q.id || !q.label) {
        throw new Error(`Main question #${i + 1} must have an ID and label.`);
      }
      if (!Array.isArray(q.subquestions) || q.subquestions.length === 0) {
        throw new Error(`Main question ${q.label} must have at least one subquestion.`);
      }

      let subSum = 0;
      for (const sub of q.subquestions) {
        if (!sub.id || !sub.label) {
          throw new Error(`Subquestion in ${q.label} must have a label.`);
        }
        if (typeof sub.maxMarks !== 'number' || sub.maxMarks <= 0) {
          throw new Error(`Subquestion ${q.label}(${sub.label}) must have maximum marks greater than 0.`);
        }
        subSum += sub.maxMarks;
      }
      q.maxMarks = subSum;
    }

    const t = await db.transaction();

    try {
      let config = await AssessmentConfiguration.findOne({
        where: {
          academicYear: { [Op.in]: ayVariants },
          departmentId,
          semester,
          subjectId,
          assessmentType,
        },
        transaction: t,
      });

      if (config) {
        const marksCount = await StudentQuestionMarks.count({
          where: { assessmentConfigurationId: config.id },
          transaction: t,
        });

        if (marksCount > 0 && !payload.confirmIncompatibleChange) {
          // Check if subquestion IDs changed
          const oldSubIds = new Set<string>();
          for (const q of config.questionPattern) {
            for (const s of q.subquestions) {
              oldSubIds.add(`${q.id}___${s.id}`);
            }
          }

          const newSubIds = new Set<string>();
          for (const q of payload.questionPattern) {
            for (const s of q.subquestions) {
              newSubIds.add(`${q.id}___${s.id}`);
            }
          }

          let isStructuralChange = false;
          for (const oldKey of Array.from(oldSubIds)) {
            if (!newSubIds.has(oldKey)) {
              isStructuralChange = true;
              break;
            }
          }

          if (isStructuralChange) {
            await t.rollback();
            return {
              requiresConfirmation: true,
              message: `Modifying this configuration will invalidate some of the ${marksCount} existing student marks. Do you want to proceed and update the configuration?`,
            };
          }
        }

        config.maximumMarks = payload.maximumMarks || 50;
        config.questionPattern = payload.questionPattern;
        config.attemptRules = payload.attemptRules;
        config.configurationVersion += 1;
        config.status = 'CONFIGURED';
        config.updatedBy = userId;
        await config.save({ transaction: t });
      } else {
        config = await AssessmentConfiguration.create(
          {
            departmentId,
            semester,
            academicYear: cleanAY,
            subjectId,
            assessmentType,
            configurationVersion: 1,
            maximumMarks: payload.maximumMarks || 50,
            questionPattern: payload.questionPattern,
            attemptRules: payload.attemptRules,
            status: 'CONFIGURED',
            createdBy: userId,
            updatedBy: userId,
          },
          { transaction: t }
        );
      }

      await t.commit();

      return {
        success: true,
        data: config,
      };
    } catch (err: any) {
      await t.rollback();
      throw err;
    }
  },

  /**
   * 7. PAGE 4: Get Question-wise Marks Entry Grid
   */
  async getQuestionWiseMarksWorkspace(
    userId: string,
    subjectId: string,
    semester: number,
    assessmentType: 'CIE1' | 'CIE2',
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);

    const config = await this.getAssessmentConfiguration(userId, subjectId, semester, assessmentType, academicYear);
    const students = await this.getConsolidatedStudentRoster(departmentId, semester, academicYear);

    let enteredMarksMap: Record<string, number | null> = {}; // key: `${studentId}___${qId}___${subId}`
    let summaryMap: Record<string, any> = {};

    if (config.id) {
      const records = await StudentQuestionMarks.findAll({
        where: { assessmentConfigurationId: config.id },
      });

      for (const r of records) {
        enteredMarksMap[`${r.studentId}___${r.questionId}___${r.subquestionId}`] =
          r.marksObtained !== null ? Number(r.marksObtained) : null;
      }

      const summaries = await StudentAssessmentSummary.findAll({
        where: { assessmentConfigurationId: config.id },
      });

      for (const s of summaries) {
        summaryMap[s.studentId] = {
          rawQuestionTotals: s.rawQuestionTotals,
          bestOfDetails: s.bestOfDetails,
          finalCieMarks: Number(s.finalCieMarks),
          percentage: Number(s.percentage),
          completionStatus: s.completionStatus,
        };
      }
    }

    // Build student rows with live authoritative calculations
    let studentsWithMarksCount = 0;
    let studentsIncompleteCount = 0;

    const studentRows = students.map((s, idx) => {
      const studentMarksObj: Record<string, number | null> = {};
      let hasAnyMarks = false;

      for (const q of config.questionPattern) {
        for (const sub of q.subquestions) {
          const key = `${q.id}___${sub.id}`;
          const fullKey = `${s.id}___${key}`;
          const markVal = enteredMarksMap[fullKey] !== undefined ? enteredMarksMap[fullKey] : null;
          studentMarksObj[key] = markVal;
          if (markVal !== null) hasAnyMarks = true;
        }
      }

      const calculated = calculateStudentCieMarks(
        config.questionPattern,
        config.attemptRules,
        config.maximumMarks,
        studentMarksObj
      );

      if (hasAnyMarks) {
        studentsWithMarksCount++;
        if (calculated.completionStatus === 'INCOMPLETE') {
          studentsIncompleteCount++;
        }
      }

      return {
        serialNumber: idx + 1,
        studentId: s.id,
        usn: s.usn,
        studentName: s.studentName,
        section: s.section,
        marks: studentMarksObj,
        rawQuestionTotals: calculated.rawQuestionTotals,
        bestOfDetails: calculated.bestOfDetails,
        finalCieMarks: calculated.finalCieMarks,
        percentage: calculated.percentage,
        completionStatus: calculated.completionStatus,
      };
    });

    const syncStatus = await bitwiseMarksBackupQueueService.getSubjectSyncStatus(subjectId, semester, cleanAY);

    return {
      configuration: config,
      students: studentRows,
      summary: {
        totalStudents: students.length,
        studentsWithMarks: studentsWithMarksCount,
        studentsIncomplete: studentsIncompleteCount,
        isSaved: config.status === 'SAVED',
        syncStatus: syncStatus.status,
        lastSyncedAt: syncStatus.lastSyncedAt,
      },
    };
  },

  /**
   * 8. PAGE 4: Save Question-wise Marks (Draft or Authoritative Marks)
   */
  async saveQuestionWiseMarks(
    userId: string,
    subjectId: string,
    semester: number,
    assessmentType: 'CIE1' | 'CIE2',
    payload: {
      marks: Array<{
        studentId: string;
        questionId: string;
        subquestionId: string;
        marksObtained: number | string | null;
      }>;
      isDraft?: boolean;
    },
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);

    const config = await this.getAssessmentConfiguration(userId, subjectId, semester, assessmentType, academicYear);
    if (!config.id) {
      throw new Error('Assessment configuration not found. Please configure the question pattern first.');
    }

    if (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(config.workflowStatus || '')) {
      throw new Error(`Assessment is locked for editing because its status is ${config.workflowStatus}. If corrections are required, wait for HOD to return it.`);
    }

    // Build quick lookup for subquestion max marks
    const subMaxMap = new Map<string, number>();
    for (const q of config.questionPattern) {
      for (const s of q.subquestions) {
        subMaxMap.set(`${q.id}___${s.id}`, s.maxMarks);
      }
    }

    // Group marks by student for transactional calculation
    const studentMarksByStudent = new Map<string, Record<string, number | null>>();

    for (const entry of payload.marks) {
      const key = `${entry.questionId}___${entry.subquestionId}`;
      const maxMarks = subMaxMap.get(key);
      if (maxMarks === undefined) {
        throw new Error(`Invalid subquestion ${entry.questionId}(${entry.subquestionId}) in marks payload.`);
      }

      const parsedMark = parseAndValidateMark(
        entry.marksObtained,
        maxMarks,
        `Mark for ${entry.questionId}(${entry.subquestionId})`
      );

      if (!studentMarksByStudent.has(entry.studentId)) {
        studentMarksByStudent.set(entry.studentId, {});
      }
      studentMarksByStudent.get(entry.studentId)![key] = parsedMark;
    }

    const t = await db.transaction();

    try {
      // 1. Bulk Upsert Student Question Marks
      for (const entry of payload.marks) {
        const key = `${entry.questionId}___${entry.subquestionId}`;
        const maxMarks = subMaxMap.get(key) || 10;
        const parsed = parseAndValidateMark(entry.marksObtained, maxMarks);

        await StudentQuestionMarks.upsert(
          {
            assessmentConfigurationId: config.id,
            studentId: entry.studentId,
            questionId: entry.questionId,
            subquestionId: entry.subquestionId,
            marksObtained: parsed,
            isAttempted: parsed !== null,
            recordStatus: payload.isDraft ? 'DRAFT' : 'SAVED',
            updatedBy: userId,
          },
          { transaction: t }
        );
      }

      // 2. Authoritative Recalculations per student
      for (const [studentId, marksMap] of Array.from(studentMarksByStudent.entries())) {
        const calculated = calculateStudentCieMarks(
          config.questionPattern,
          config.attemptRules,
          config.maximumMarks,
          marksMap
        );

        await StudentAssessmentSummary.upsert(
          {
            assessmentConfigurationId: config.id,
            studentId,
            rawQuestionTotals: calculated.rawQuestionTotals,
            bestOfDetails: calculated.bestOfDetails,
            finalCieMarks: calculated.finalCieMarks,
            percentage: calculated.percentage,
            completionStatus: calculated.completionStatus,
          },
          { transaction: t }
        );
      }

      // Update config status
      await AssessmentConfiguration.update(
        {
          status: payload.isDraft ? 'CONFIGURED' : 'SAVED',
          updatedBy: userId,
        },
        {
          where: { id: config.id },
          transaction: t,
        }
      );

      await t.commit();

      // Trigger asynchronous Google Drive sync if not a pure draft
      if (!payload.isDraft) {
        bitwiseMarksBackupQueueService.queueMarksBackup(
          subjectId,
          semester,
          cleanAY,
          departmentId,
          'UPDATE'
        ).catch((err) => logger.warn('Google Drive marks backup queue error:', err.message));
      }

      return {
        success: true,
        message: payload.isDraft ? 'Draft saved successfully.' : 'Marks saved and validated successfully.',
      };
    } catch (err: any) {
      await t.rollback();
      logger.error('SAVE_QUESTION_WISE_MARKS_ERROR:', err);
      throw err;
    }
  },

  /**
   * 9. PAGE 5: Get Assignment Configuration and Marks Grid
   */
  async getAssignmentMarksWorkspace(
    userId: string,
    subjectId: string,
    semester: number,
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);

    const subject = await Subject.findByPk(subjectId);
    const department = await Department.findByPk(departmentId);

    let config = await AssignmentConfiguration.findOne({
      where: {
        academicYear: { [Op.in]: ayVariants },
        departmentId,
        semester,
        subjectId,
      },
    });

    const isConfigured = !!config && Array.isArray(config.components) && config.components.length > 0;
    const components: AssignmentComponentDef[] = isConfigured ? config.components : [];
    const maximumMarks = 25;
    const calculationPolicy = config?.calculationPolicy || { type: 'SUM', scaledMaxMarks: 25 };

    const students = await this.getConsolidatedStudentRoster(departmentId, semester, academicYear);

    let marksMap: Record<string, number | null> = {};
    let summaryMap: Record<string, any> = {};

    if (config && isConfigured) {
      const records = await StudentAssignmentMarks.findAll({
        where: { assignmentConfigurationId: config.id },
      });
      for (const r of records) {
        marksMap[`${r.studentId}___${r.componentId}`] = r.marksObtained !== null ? Number(r.marksObtained) : null;
      }

      const summaries = await StudentAssignmentSummary.findAll({
        where: { assignmentConfigurationId: config.id },
      });
      for (const s of summaries) {
        summaryMap[s.studentId] = {
          rawTotal: Number(s.rawTotal),
          scaledTotal: Number(s.scaledTotal),
          completionStatus: s.completionStatus,
        };
      }
    }

    const studentRows = students.map((s, idx) => {
      const studentMarksObj: Record<string, number | null> = {};
      for (const comp of components) {
        const val = marksMap[`${s.id}___${comp.id}`];
        studentMarksObj[comp.id] = val !== undefined ? val : null;
      }

      const calc = isConfigured
        ? calculateStudentAssignmentMarks(
            components,
            maximumMarks,
            calculationPolicy as any,
            studentMarksObj
          )
        : { rawTotal: 0, scaledTotal: 0, completionStatus: 'INCOMPLETE' as const };

      return {
        serialNumber: idx + 1,
        studentId: s.id,
        usn: s.usn,
        studentName: s.studentName,
        section: s.section,
        marks: studentMarksObj,
        rawTotal: calc.rawTotal,
        scaledTotal: calc.scaledTotal,
        completionStatus: calc.completionStatus,
      };
    });

    return {
      isConfigured,
      configuration: isConfigured && config
        ? {
            id: config.id,
            departmentId,
            departmentName: department?.name || 'Department',
            departmentCode: department?.code || 'CSE',
            semester,
            academicYear: cleanAY,
            subjectId,
            subjectCode: subject?.code || 'SUB001',
            subjectName: subject?.name || 'Assigned Subject',
            maximumMarks: 25,
            components,
            calculationPolicy,
            status: config.status || 'SAVED',
          }
        : null,
      department: {
        id: departmentId,
        name: department?.name || 'Department',
        code: department?.code || 'CSE',
      },
      subject: {
        id: subjectId,
        name: subject?.name || 'Subject',
        code: subject?.code || 'SUB',
      },
      semester,
      academicYear: cleanAY,
      students: studentRows,
    };
  },

  /**
   * 10. PAGE 5: Save/Configure Assignment Pattern (Single or Divided)
   */
  async saveAssignmentConfiguration(
    userId: string,
    subjectId: string,
    semester: number,
    payload: {
      components: AssignmentComponentDef[];
      confirmPatternChange?: boolean;
    },
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);

    if (!payload.components || !Array.isArray(payload.components) || payload.components.length === 0) {
      throw new Error('At least one assignment component is required.');
    }

    let totalMarks = 0;
    const sanitizedComponents: AssignmentComponentDef[] = [];

    for (let i = 0; i < payload.components.length; i++) {
      const c = payload.components[i];
      const label = (c.label || '').trim();
      if (!label) {
        throw new Error(`Component #${i + 1} must have a non-empty name.`);
      }
      const maxMarks = Number(c.maxMarks);
      if (isNaN(maxMarks) || maxMarks <= 0) {
        throw new Error(`Component "${label}" maximum marks must be greater than 0.`);
      }
      totalMarks += maxMarks;
      const compId = c.id && c.id.trim() !== '' ? c.id.trim() : `comp_${Date.now()}_${i}`;
      sanitizedComponents.push({
        id: compId,
        label,
        maxMarks,
      });
    }

    if (totalMarks !== 25) {
      throw new Error('Assignment components must total exactly 25 marks.');
    }

    let config = await AssignmentConfiguration.findOne({
      where: {
        academicYear: { [Op.in]: ayVariants },
        departmentId,
        semester,
        subjectId,
      },
    });

    if (!config) {
      config = await AssignmentConfiguration.create({
        departmentId,
        semester,
        academicYear: cleanAY,
        subjectId,
        maximumMarks: 25,
        components: sanitizedComponents,
        calculationPolicy: { type: 'SUM', scaledMaxMarks: 25 },
        status: 'SAVED',
        createdBy: userId,
        updatedBy: userId,
      });
    } else {
      config.components = sanitizedComponents;
      config.maximumMarks = 25;
      config.status = 'SAVED';
      config.updatedBy = userId;
      await config.save();
    }

    // Trigger Excel sync in background
    bitwiseMarksBackupQueueService
      .queueMarksBackup(subjectId, semester, cleanAY, departmentId, 'UPDATE')
      .catch((err) => logger.warn('Google Drive assignment backup queue error:', err?.message || err));

    return {
      success: true,
      message: 'Assignment configuration saved successfully.',
      configuration: config,
    };
  },

  /**
   * 11. PAGE 5: Save Assignment Marks
   */
  async saveAssignmentMarks(
    userId: string,
    subjectId: string,
    semester: number,
    payload: {
      maximumMarks?: number;
      components?: AssignmentComponentDef[];
      calculationPolicy?: any;
      marks: Array<{
        studentId: string;
        componentId: string;
        marksObtained: number | string | null;
      }>;
      isDraft?: boolean;
    },
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);

    const t = await db.transaction();

    try {
      let config = await AssignmentConfiguration.findOne({
        where: {
          academicYear: { [Op.in]: ayVariants },
          departmentId,
          semester,
          subjectId,
        },
        transaction: t,
      });

      if (!config) {
        if (payload.components && Array.isArray(payload.components) && payload.components.length > 0) {
          let sum = 0;
          for (const c of payload.components) {
            sum += Number(c.maxMarks) || 0;
          }
          if (sum !== 25) {
            throw new Error('Assignment components must total exactly 25 marks.');
          }
          config = await AssignmentConfiguration.create(
            {
              departmentId,
              semester,
              academicYear: cleanAY,
              subjectId,
              maximumMarks: 25,
              components: payload.components,
              calculationPolicy: { type: 'SUM', scaledMaxMarks: 25 },
              status: payload.isDraft ? 'DRAFT' : 'SAVED',
              createdBy: userId,
              updatedBy: userId,
            },
            { transaction: t }
          );
        } else {
          throw new Error('Assignment pattern has not been configured. Please configure assignment components first.');
        }
      }

      const components = config.components || [];
      const maxMarks = 25;
      const calcPolicy = config.calculationPolicy || { type: 'SUM', scaledMaxMarks: 25 };

      const compMaxMap = new Map<string, number>();
      for (const c of components) {
        compMaxMap.set(c.id, c.maxMarks);
      }

      const studentMarksMap = new Map<string, Record<string, number | null>>();

      for (const entry of payload.marks) {
        const cMax = compMaxMap.get(entry.componentId);
        if (cMax === undefined) continue; // Skip unknown components

        const parsed = parseAndValidateMark(entry.marksObtained, cMax, `Assignment (${entry.componentId})`);

        await StudentAssignmentMarks.upsert(
          {
            assignmentConfigurationId: config.id,
            studentId: entry.studentId,
            componentId: entry.componentId,
            marksObtained: parsed,
            recordStatus: payload.isDraft ? 'DRAFT' : 'SAVED',
            updatedBy: userId,
          },
          { transaction: t }
        );

        if (!studentMarksMap.has(entry.studentId)) {
          studentMarksMap.set(entry.studentId, {});
        }
        studentMarksMap.get(entry.studentId)![entry.componentId] = parsed;
      }

      // Calculate assignment summaries per student
      for (const [studentId, enteredMarks] of Array.from(studentMarksMap.entries())) {
        const calc = calculateStudentAssignmentMarks(components, maxMarks, calcPolicy, enteredMarks);

        await StudentAssignmentSummary.upsert(
          {
            assignmentConfigurationId: config.id,
            studentId,
            rawTotal: calc.rawTotal,
            scaledTotal: calc.scaledTotal,
            completionStatus: calc.completionStatus,
          },
          { transaction: t }
        );
      }

      await t.commit();

      if (!payload.isDraft) {
        bitwiseMarksBackupQueueService.queueMarksBackup(
          subjectId,
          semester,
          cleanAY,
          departmentId,
          'UPDATE'
        ).catch((err) => logger.warn('Google Drive assignment backup queue error:', err.message));
      }

      return {
        success: true,
        message: 'Assignment marks saved successfully.',
      };
    } catch (err: any) {
      await t.rollback();
      logger.error('SAVE_ASSIGNMENT_MARKS_ERROR:', err);
      throw err;
    }
  },

  /**
   * 11. PAGE 6: Get Final Internal Marks Sheet
   */
  async getFinalInternalMarksWorkspace(
    userId: string,
    subjectId: string,
    semester: number,
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);

    const subject = await Subject.findByPk(subjectId);
    const department = await Department.findByPk(departmentId);

    const students = await this.getConsolidatedStudentRoster(departmentId, semester, academicYear);

    // Fetch CIE-1 Config and Summaries
    const cie1Config = await AssessmentConfiguration.findOne({
      where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId, assessmentType: 'CIE1' },
    });
    const cie1Summaries = cie1Config
      ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie1Config.id } })
      : [];
    const cie1Map = new Map<string, number>();
    for (const s of cie1Summaries) {
      cie1Map.set(s.studentId, Number(s.finalCieMarks));
    }

    // Fetch CIE-2 Config and Summaries
    const cie2Config = await AssessmentConfiguration.findOne({
      where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId, assessmentType: 'CIE2' },
    });
    const cie2Summaries = cie2Config
      ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie2Config.id } })
      : [];
    const cie2Map = new Map<string, number>();
    for (const s of cie2Summaries) {
      cie2Map.set(s.studentId, Number(s.finalCieMarks));
    }

    // Fetch Assignment Config and Summaries
    const assignConfig = await AssignmentConfiguration.findOne({
      where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId },
    });
    const assignSummaries = assignConfig
      ? await StudentAssignmentSummary.findAll({ where: { assignmentConfigurationId: assignConfig.id } })
      : [];
    const assignRawMap = new Map<string, number>();
    const assignScaledMap = new Map<string, number>();
    for (const a of assignSummaries) {
      assignRawMap.set(a.studentId, Number(a.rawTotal));
      assignScaledMap.set(a.studentId, Number(a.scaledTotal));
    }

    // Existing saved final internal marks
    const savedFinalMarks = await FinalInternalMarks.findAll({
      where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId },
    });
    const savedMap = new Map<string, FinalInternalMarks>();
    for (const f of savedFinalMarks) {
      savedMap.set(f.studentId, f);
    }

    const policy = {
      cieRule: 'AVERAGE' as 'AVERAGE' | 'BEST_OF',
      cieWeight: 50,
      assignmentWeight: 25,
      finalMaxMarks: 50,
      scalingFormula: 'STANDARD_VTU_50' as 'STANDARD_VTU_50' | 'DIRECT_SUM' | 'CUSTOM',
    };

    const studentRows = students.map((s, idx) => {
      const c1 = cie1Map.has(s.id) ? cie1Map.get(s.id)! : null;
      const c2 = cie2Map.has(s.id) ? cie2Map.get(s.id)! : null;
      const aRaw = assignRawMap.has(s.id) ? assignRawMap.get(s.id)! : null;
      const aScaled = assignScaledMap.has(s.id) ? assignScaledMap.get(s.id)! : null;

      const calc = calculateFinalInternalMarks(c1, c2, aScaled, policy);

      const saved = savedMap.get(s.id);
      const isFinalized = saved?.status === 'FINALIZED';

      return {
        serialNumber: idx + 1,
        studentId: s.id,
        usn: s.usn,
        studentName: s.studentName,
        section: s.section,
        cie1Marks: c1,
        cie2Marks: c2,
        cieAverageOrPolicyResult: calc.cieResult,
        cieScaled25: calc.cieScaled25,
        assignmentRawMarks: aRaw,
        assignmentScaledMarks: aScaled,
        finalInternalMarks: calc.finalInternalMarks,
        maxFinalMarks: policy.finalMaxMarks,
        status: isFinalized ? 'FINALIZED' : calc.status === 'READY' ? 'READY' : 'INCOMPLETE',
      };
    });

    const isAllFinalized = studentRows.length > 0 && studentRows.every((r) => r.status === 'FINALIZED');

    return {
      metadata: {
        departmentId,
        departmentName: department?.name || 'Department',
        departmentCode: department?.code || 'CSE',
        semester,
        academicYear: cleanAY,
        subjectId,
        subjectCode: subject?.code || 'SUB001',
        subjectName: subject?.name || 'Assigned Subject',
        policy,
        isFinalized: isAllFinalized,
      },
      students: studentRows,
    };
  },

  /**
   * 12. PAGE 6: Save and Finalize Final Internal Marks
   */
  async saveFinalInternalMarks(
    userId: string,
    subjectId: string,
    semester: number,
    payload: {
      finalize?: boolean;
      policy?: any;
    },
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);

    const workspace = await this.getFinalInternalMarksWorkspace(userId, subjectId, semester, academicYear);

    const cie1Config = await AssessmentConfiguration.findOne({
      where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId, assessmentType: 'CIE1' },
    });
    const cie2Config = await AssessmentConfiguration.findOne({
      where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId, assessmentType: 'CIE2' },
    });
    const assignConfig = await AssignmentConfiguration.findOne({
      where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId },
    });

    const t = await db.transaction();

    try {
      for (const row of workspace.students) {
        await FinalInternalMarks.upsert(
          {
            departmentId,
            semester,
            academicYear: cleanAY,
            subjectId,
            studentId: row.studentId,
            cie1ConfigId: cie1Config?.id || null,
            cie1Marks: row.cie1Marks,
            cie2ConfigId: cie2Config?.id || null,
            cie2Marks: row.cie2Marks,
            cieAverageOrPolicyResult: row.cieAverageOrPolicyResult,
            assignmentConfigId: assignConfig?.id || null,
            assignmentRawMarks: row.assignmentRawMarks,
            assignmentScaledMarks: row.assignmentScaledMarks,
            finalInternalMarks: row.finalInternalMarks,
            maxFinalInternalMarks: row.maxFinalMarks || 50,
            calculationPolicy: payload.policy || workspace.metadata.policy,
            status: payload.finalize ? 'FINALIZED' : 'SAVED',
            finalizedAt: payload.finalize ? new Date() : null,
            finalizedBy: payload.finalize ? userId : null,
          },
          { transaction: t }
        );
      }

      await t.commit();

      // Trigger Drive sync
      bitwiseMarksBackupQueueService.queueMarksBackup(
        subjectId,
        semester,
        cleanAY,
        departmentId,
        'UPDATE'
      ).catch((err) => logger.warn('Google Drive final marks backup queue error:', err.message));

      return {
        success: true,
        message: payload.finalize ? 'Final internal marks submitted and locked successfully.' : 'Final internal marks saved successfully.',
      };
    } catch (err: any) {
      await t.rollback();
      logger.error('SAVE_FINAL_INTERNAL_MARKS_ERROR:', err);
      throw err;
    }
  },

  /**
   * 13. PAGE 7: Get External Examination Marks with VTU Passing Status
   */
  async getExternalMarksWorkspace(
    userId: string,
    subjectId: string,
    semester: number,
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);

    const subject = await Subject.findByPk(subjectId);
    const department = await Department.findByPk(departmentId);
    const students = await this.getConsolidatedStudentRoster(departmentId, semester, academicYear);

    const isLabOrPractical = Boolean(
      subject?.type?.toUpperCase().includes('LAB') ||
      subject?.type?.toUpperCase().includes('PRACTICAL') ||
      subject?.code?.toUpperCase().includes('L') ||
      subject?.name?.toUpperCase().includes('LAB') ||
      subject?.name?.toUpperCase().includes('PRACTICAL')
    );

    // 1. Fetch Final Internal Marks (CIE out of 50M)
    const finalRecords = await FinalInternalMarks.findAll({
      where: {
        academicYear: { [Op.in]: ayVariants },
        departmentId,
        semester,
        subjectId,
      },
    });
    const finalMap = new Map<string, number | null>();
    let isInternalFinalized = false;
    if (finalRecords.length > 0) {
      isInternalFinalized = finalRecords.every((r) => r.status === 'FINALIZED');
      for (const r of finalRecords) {
        if (r.finalInternalMarks !== null && r.finalInternalMarks !== undefined) {
          finalMap.set(r.studentId, Number(r.finalInternalMarks));
        }
      }
    }

    // Fallback: If FinalInternalMarks hasn't been generated for some students, calculate from Assessment Summaries
    if (finalMap.size < students.length) {
      const cie1Cfg = await AssessmentConfiguration.findOne({
        where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId, assessmentType: 'CIE1' },
      });
      const cie2Cfg = await AssessmentConfiguration.findOne({
        where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId, assessmentType: 'CIE2' },
      });
      const assignCfg = await AssignmentConfiguration.findOne({
        where: { academicYear: { [Op.in]: ayVariants }, departmentId, semester, subjectId },
      });

      const cie1Sums = cie1Cfg ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie1Cfg.id } }) : [];
      const cie2Sums = cie2Cfg ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie2Cfg.id } }) : [];
      const assignSums = assignCfg ? await StudentAssignmentSummary.findAll({ where: { assignmentConfigurationId: assignCfg.id } }) : [];

      const c1Map = new Map<string, number>();
      for (const s of cie1Sums) if (s.finalCieMarks !== null) c1Map.set(s.studentId, Number(s.finalCieMarks));

      const c2Map = new Map<string, number>();
      for (const s of cie2Sums) if (s.finalCieMarks !== null) c2Map.set(s.studentId, Number(s.finalCieMarks));

      const aMap = new Map<string, number>();
      for (const s of assignSums) if (s.scaledTotal !== null) aMap.set(s.studentId, Number(s.scaledTotal));

      for (const s of students) {
        if (!finalMap.has(s.id)) {
          const c1 = c1Map.get(s.id) ?? null;
          const c2 = c2Map.get(s.id) ?? null;
          const a = aMap.get(s.id) ?? null;
          if (c1 !== null || c2 !== null || a !== null) {
            const cieAvg = c1 !== null && c2 !== null ? (c1 + c2) / 2 : c1 ?? c2 ?? 0;
            const scaledCie = (cieAvg / 50) * 25;
            const finalCie = Math.min(Math.round(scaledCie + (a ?? 0)), 50);
            finalMap.set(s.id, finalCie);
          }
        }
      }
    }

    const extRecords = await ExternalExaminationMarks.findAll({
      where: {
        academicYear: { [Op.in]: ayVariants },
        departmentId,
        semester,
        subjectId,
      },
    });

    const extMap = new Map<string, ExternalExaminationMarks>();
    for (const r of extRecords) {
      extMap.set(r.studentId, r);
    }

    const studentRows = students.map((s, idx) => {
      const rec = extMap.get(s.id);
      const finalCie = finalMap.get(s.id) ?? null;
      const rawExt = rec?.externalMarks !== null && rec?.externalMarks !== undefined ? Number(rec.externalMarks) : null;
      const maxExt = rec?.maximumMarks !== undefined ? Number(rec.maximumMarks) : 100;

      const vtuCalc = calculateVtuPassingStatus(finalCie, rawExt, maxExt, isLabOrPractical);

      return {
        serialNumber: idx + 1,
        studentId: s.id,
        usn: s.usn,
        studentName: s.studentName,
        section: s.section,
        finalInternalMarks: finalCie,
        externalMarks: rawExt,
        maximumMarks: maxExt,
        seeScaled50: vtuCalc.seeScaled50,
        totalMarks: vtuCalc.totalMarks,
        status: vtuCalc.status,
        reason: vtuCalc.reason,
        ciePassed: vtuCalc.ciePassed,
        seePassed: vtuCalc.seePassed,
        aggregatePassed: vtuCalc.aggregatePassed,
      };
    });

    return {
      metadata: {
        departmentId,
        departmentName: department?.name || 'Department',
        departmentCode: department?.code || 'CSE',
        semester,
        academicYear: cleanAY,
        subjectId,
        subjectCode: subject?.code || 'SUB001',
        subjectName: subject?.name || 'Assigned Subject',
        subjectType: subject?.type || 'CC',
        isLabOrPractical,
        isInternalFinalized,
        defaultMaxMarks: 100,
      },
      students: studentRows,
    };
  },

  /**
   * 14. PAGE 7: Save External Examination Marks with VTU Pass/Fail Status
   */
  async saveExternalMarks(
    userId: string,
    subjectId: string,
    semester: number,
    payload: {
      maximumMarks?: number;
      marks: Array<{
        studentId: string;
        externalMarks: number | string | null;
      }>;
    },
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);
    const ayVariants = getAYVariants(academicYear);
    const maxMarks = payload.maximumMarks || 100;

    const subject = await Subject.findByPk(subjectId);
    const isLabOrPractical = Boolean(
      subject?.type?.toUpperCase().includes('LAB') ||
      subject?.type?.toUpperCase().includes('PRACTICAL') ||
      subject?.code?.toUpperCase().includes('L') ||
      subject?.name?.toUpperCase().includes('LAB') ||
      subject?.name?.toUpperCase().includes('PRACTICAL')
    );

    // Fetch Final Internal Marks for VTU calculation
    const finalRecords = await FinalInternalMarks.findAll({
      where: {
        academicYear: { [Op.in]: ayVariants },
        departmentId,
        semester,
        subjectId,
      },
    });
    const finalCieMap = new Map<string, number | null>();
    for (const r of finalRecords) {
      if (r.finalInternalMarks !== null && r.finalInternalMarks !== undefined) {
        finalCieMap.set(r.studentId, Number(r.finalInternalMarks));
      }
    }

    const t = await db.transaction();

    try {
      for (const entry of payload.marks) {
        const parsed = parseAndValidateMark(entry.externalMarks, maxMarks, 'External Examination Mark');
        const studentCie = finalCieMap.get(entry.studentId) ?? null;
        const vtuCalc = calculateVtuPassingStatus(studentCie, parsed, maxMarks, isLabOrPractical);

        await ExternalExaminationMarks.upsert(
          {
            departmentId,
            semester,
            academicYear: cleanAY,
            subjectId,
            studentId: entry.studentId,
            externalMarks: parsed,
            maximumMarks: maxMarks,
            status: vtuCalc.status, // 'PASS' | 'FAIL' | 'NOT_ENTERED'
            updatedBy: userId,
          },
          { transaction: t }
        );
      }

      await t.commit();

      // Trigger Drive sync
      bitwiseMarksBackupQueueService.queueMarksBackup(
        subjectId,
        semester,
        cleanAY,
        departmentId,
        'UPDATE'
      ).catch((err) => logger.warn('Google Drive external marks backup queue error:', err.message));

      return {
        success: true,
        message: 'External examination marks saved and VTU pass/fail status updated.',
      };
    } catch (err: any) {
      await t.rollback();
      logger.error('SAVE_EXTERNAL_MARKS_ERROR:', err);
      throw err;
    }
  },

  /**
   * 15. Export Excel Workbook
   */
  async exportSubjectMarksExcel(
    userId: string,
    subjectId: string,
    semester: number,
    academicYear?: string
  ) {
    const { departmentId } = await this.verifyFacultySubjectAuthorization(userId, subjectId, semester, academicYear);
    const cleanAY = normalizeAY(academicYear);

    return await bitwiseMarksExcelService.generateSubjectMarksWorkbook(
      subjectId,
      semester,
      cleanAY,
      departmentId
    );
  },
};

export default bitwiseMarksService;
