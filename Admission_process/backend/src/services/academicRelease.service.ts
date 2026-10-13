import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import AcademicRelease, { AssessmentType } from '../models/AcademicRelease';
import StudentReleasedAcademicData from '../models/StudentReleasedAcademicData';
import ConsolidatedAttendanceBackupFile from '../models/ConsolidatedAttendanceBackupFile';
import MarksBackupFile from '../models/MarksBackupFile';
import GoogleDriveIntegration from '../models/GoogleDriveIntegration';
import Department from '../models/Department';
import Subject from '../models/Subject';
import Student from '../models/Student';
import User from '../models/User';
import FacultyAssignment from '../models/FacultyAssignment';
import Section from '../models/Section';
import AssessmentConfiguration from '../models/AssessmentConfiguration';
import StudentAssessmentSummary from '../models/StudentAssessmentSummary';
import AssignmentConfiguration from '../models/AssignmentConfiguration';
import StudentAssignmentSummary from '../models/StudentAssignmentSummary';
import FinalInternalMarks from '../models/FinalInternalMarks';
import ExternalExaminationMarks from '../models/ExternalExaminationMarks';
import googleDriveService from './googleDrive.service';
import semesterAttendanceConsolidationService from './semesterAttendanceConsolidation.service';
import bitwiseMarksExcelService from './bitwiseMarksExcel.service';
import bitwiseMarksBackupQueueService from './bitwiseMarksBackupQueue.service';
import logger from '../utils/logger.util';

const getAYVariants = (ay?: string): string[] => {
  if (!ay || ay === 'ALL') return [];
  const clean = ay.trim().replace(/\u2013|\u2014/g, '-');
  const enDash = clean.replace(/-/g, '–');
  const emDash = clean.replace(/-/g, '—');
  return Array.from(new Set([clean, enDash, emDash, ay.trim()]));
};

export const SUPPORTED_ASSESSMENT_TYPES: Array<{
  type: AssessmentType;
  label: string;
  sheetName: string;
  defaultMaxMarks: number;
}> = [
  { type: 'CIE1', label: 'CIE-1 Marks', sheetName: 'CIE-1 Bitwise', defaultMaxMarks: 50 },
  { type: 'CIE2', label: 'CIE-2 Marks', sheetName: 'CIE-2 Bitwise', defaultMaxMarks: 50 },
  { type: 'ASSIGNMENT', label: 'Assignment Marks', sheetName: 'Assignment Marks', defaultMaxMarks: 25 },
  { type: 'FINAL_INTERNAL', label: 'Final Internal Marks', sheetName: 'Final Internal Marks', defaultMaxMarks: 50 },
  { type: 'EXTERNAL', label: 'External Marks', sheetName: 'External Marks', defaultMaxMarks: 100 },
];

function generateDataFingerprint(data: any): string {
  const jsonStr = JSON.stringify(data);
  return crypto.createHash('sha256').update(jsonStr).digest('hex').substring(0, 32);
}

export const academicReleaseService = {
  /**
   * 1. Get Authorized Semesters for the HOD
   * Returns semester cards with subject counts, attendance release progress, and marks release progress.
   */
  async getAuthorizedSemesters(params: {
    departmentId: string;
    isSemesterHandling: boolean;
    academicYear: string;
  }) {
    const { departmentId, isSemesterHandling, academicYear } = params;
    const department = await Department.findByPk(departmentId);
    if (!department) throw new Error('Department not found.');

    const cleanAY = academicYear.trim();
    const semesters = isSemesterHandling ? [1, 2] : [1, 2, 3, 4, 5, 6, 7, 8];

    const results = await Promise.all(
      semesters.map(async (sem) => {
        // Find active subjects for this semester
        const subjects = await this.getRawActiveSubjects(departmentId, isSemesterHandling, sem);
        const totalSubjects = subjects.length;

        if (totalSubjects === 0) {
          return {
            semester: sem,
            name: `Semester ${sem}`,
            departmentScope: isSemesterHandling ? 'Applied Science (Sem 1 & 2)' : `${department.code} - Sem ${sem}`,
            departmentCode: department.code,
            departmentName: department.name,
            totalSubjects: 0,
            attendanceRelease: {
              total: 0,
              released: 0,
              percentage: 0,
              status: 'NOT_RELEASED',
            },
            marksRelease: {
              totalAssessments: 0,
              releasedAssessments: 0,
              percentage: 0,
              status: 'NOT_RELEASED',
            },
          };
        }

        const subjectIds = subjects.map((s) => s.id);

        // Attendance releases
        const attendanceReleases = await AcademicRelease.findAll({
          where: {
            departmentId,
            academicYear: cleanAY,
            semester: sem,
            subjectId: { [Op.in]: subjectIds },
            releaseType: 'ATTENDANCE',
            status: 'RELEASED',
          },
        });
        const releasedAttendanceCount = attendanceReleases.length;
        const attendancePct = Math.round((releasedAttendanceCount / totalSubjects) * 100);

        // Marks releases
        const totalPossibleAssessments = totalSubjects * 5; // 5 assessments per subject
        const marksReleases = await AcademicRelease.findAll({
          where: {
            departmentId,
            academicYear: cleanAY,
            semester: sem,
            subjectId: { [Op.in]: subjectIds },
            releaseType: 'MARKS',
            status: 'RELEASED',
          },
        });
        const releasedMarksCount = marksReleases.length;
        const marksPct = Math.round((releasedMarksCount / totalPossibleAssessments) * 100);

        return {
          semester: sem,
          name: `Semester ${sem}`,
          departmentScope: isSemesterHandling ? 'Applied Science (Sem 1 & 2)' : `${department.code} - Sem ${sem}`,
          departmentCode: department.code,
          departmentName: department.name,
          totalSubjects,
          attendanceRelease: {
            total: totalSubjects,
            released: releasedAttendanceCount,
            percentage: attendancePct,
            status:
              releasedAttendanceCount === totalSubjects
                ? 'RELEASED'
                : releasedAttendanceCount > 0
                ? 'PARTIALLY_RELEASED'
                : 'NOT_RELEASED',
          },
          marksRelease: {
            totalAssessments: totalPossibleAssessments,
            releasedAssessments: releasedMarksCount,
            percentage: marksPct,
            status:
              releasedMarksCount === totalPossibleAssessments
                ? 'RELEASED'
                : releasedMarksCount > 0
                ? 'PARTIALLY_RELEASED'
                : 'NOT_RELEASED',
          },
        };
      })
    );

    return results;
  },

  /**
   * Helper: Resolves raw active subjects according to HOD department scope
   */
  async getRawActiveSubjects(departmentId: string, isSemesterHandling: boolean, semester: number) {
    const whereClause: any = {
      semester,
      status: 'ACTIVE',
    };

    if (isSemesterHandling) {
      const orConditions: any[] = [
        { departmentId },
        { cycle: { [Op.in]: ['P_CYCLE', 'C_CYCLE'] } },
      ];

      // Subjects assigned to faculty in this semester
      const assignedRows = await FacultyAssignment.findAll({
        where: { semester, status: 'ACTIVE' },
        attributes: ['subjectId'],
        raw: true,
      });
      const assignedIds = Array.from(new Set(assignedRows.map((r: any) => r.subjectId).filter(Boolean)));
      if (assignedIds.length > 0) {
        orConditions.push({ id: { [Op.in]: assignedIds } });
      }

      whereClause[Op.or] = orConditions;
    } else {
      whereClause.departmentId = departmentId;
    }

    return Subject.findAll({
      where: whereClause,
      order: [['code', 'ASC']],
    });
  },

  /**
   * 2. Automatically Display Active Subjects for Selected Semester
   */
  async getSubjectsWithReleaseStatus(params: {
    departmentId: string;
    isSemesterHandling: boolean;
    semester: number;
    academicYear: string;
  }) {
    const { departmentId, isSemesterHandling, semester, academicYear } = params;
    const cleanAY = academicYear.trim();

    const subjects = await this.getRawActiveSubjects(departmentId, isSemesterHandling, semester);
    if (subjects.length === 0) return [];

    const subjectIds = subjects.map((s) => s.id);

    // Fetch existing releases
    const existingReleases = await AcademicRelease.findAll({
      where: {
        departmentId,
        academicYear: cleanAY,
        semester,
        subjectId: { [Op.in]: subjectIds },
      },
      include: [{ model: User, as: 'releasedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    });

    const releaseMap = new Map<string, AcademicRelease>();
    existingReleases.forEach((rel) => {
      const key = `${rel.subjectId}___${rel.releaseType}___${rel.assessmentType}`;
      releaseMap.set(key, rel);
    });

    // Check Google Drive file presence
    const consBackup = await ConsolidatedAttendanceBackupFile.findOne({
      where: {
        departmentId,
        academicYear: cleanAY,
        semester,
      },
    });

    const marksBackups = await MarksBackupFile.findAll({
      where: {
        departmentId,
        academicYear: cleanAY,
        semester,
        subjectId: { [Op.in]: subjectIds },
      },
    });
    const marksBackupMap = new Map<string, MarksBackupFile>();
    marksBackups.forEach((mb) => marksBackupMap.set(mb.subjectId, mb));

    const consFingerprint = consBackup
      ? (consBackup as any).fileHash || `${consBackup.googleDriveFileId}_${consBackup.updatedAt}`
      : null;

    return subjects.map((sub) => {
      // 1. Attendance status
      const attRelease = releaseMap.get(`${sub.id}___ATTENDANCE___ATTENDANCE`);
      let attendanceStatus = 'READY';
      if (attRelease) {
        attendanceStatus = attRelease.status;
      }

      // Check if source file updated since last release
      const attSourceUpdated = Boolean(
        attRelease &&
        attRelease.status === 'RELEASED' &&
        attRelease.sourceFingerprint &&
        consFingerprint &&
        attRelease.sourceFingerprint !== consFingerprint
      );

      // 2. Marks assessments status
      const marksBackup = marksBackupMap.get(sub.id);
      const marksFingerprint = marksBackup
        ? (marksBackup as any).fileHash || `${marksBackup.googleDriveFileId}_${marksBackup.updatedAt}`
        : null;

      const assessmentStatuses: Record<string, any> = {};
      let releasedMarksCount = 0;

      SUPPORTED_ASSESSMENT_TYPES.forEach((asType) => {
        const mRel = releaseMap.get(`${sub.id}___MARKS___${asType.type}`);
        const mSourceUpdated = Boolean(
          mRel &&
          mRel.status === 'RELEASED' &&
          mRel.sourceFingerprint &&
          marksFingerprint &&
          mRel.sourceFingerprint !== marksFingerprint
        );

        if (mRel && mRel.status === 'RELEASED') {
          releasedMarksCount++;
          assessmentStatuses[asType.type] = {
            type: asType.type,
            label: asType.label,
            status: 'RELEASED',
            releasedAt: mRel.releasedAt,
            releasedBy: mRel.releasedByUser
              ? `${mRel.releasedByUser.firstName || ''} ${mRel.releasedByUser.lastName || ''}`.trim()
              : null,
            totalStudents: mRel.totalStudentsCount,
            isSourceUpdated: mSourceUpdated,
          };
        } else {
          assessmentStatuses[asType.type] = {
            type: asType.type,
            label: asType.label,
            status: 'READY',
            releasedAt: null,
            releasedBy: null,
            totalStudents: 0,
            isSourceUpdated: false,
          };
        }
      });

      let overallMarksStatus = 'NOT_RELEASED';
      if (releasedMarksCount === SUPPORTED_ASSESSMENT_TYPES.length) {
        overallMarksStatus = 'FULLY_RELEASED';
      } else if (releasedMarksCount > 0) {
        overallMarksStatus = 'PARTIALLY_RELEASED';
      }

      const anyMarksSourceUpdated = Boolean(
        releasedMarksCount > 0 &&
        marksFingerprint &&
        SUPPORTED_ASSESSMENT_TYPES.some((asType) => {
          const mRel = releaseMap.get(`${sub.id}___MARKS___${asType.type}`);
          return (
            mRel &&
            mRel.status === 'RELEASED' &&
            mRel.sourceFingerprint &&
            mRel.sourceFingerprint !== marksFingerprint
          );
        })
      );

      return {
        id: sub.id,
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        semester: sub.semester,
        type: sub.type,
        cycle: sub.cycle || null,
        attendance: {
          status: attendanceStatus,
          isReleased: Boolean(attRelease && attRelease.status === 'RELEASED'),
          releasedAt: attRelease?.releasedAt || null,
          releasedBy: attRelease?.releasedByUser
            ? `${attRelease.releasedByUser.firstName || ''} ${attRelease.releasedByUser.lastName || ''}`.trim()
            : null,
          totalStudents: attRelease?.totalStudentsCount || 0,
          hasDriveFile: Boolean(consBackup?.googleDriveFileId),
          fileName: consBackup?.fileName || null,
          isSourceUpdated: attSourceUpdated,
        },
        marks: {
          status: overallMarksStatus,
          releasedCount: releasedMarksCount,
          totalAssessments: SUPPORTED_ASSESSMENT_TYPES.length,
          assessments: assessmentStatuses,
          hasDriveFile: Boolean(marksBackup?.googleDriveFileId),
          fileName: marksBackup?.fileName || null,
          isSourceUpdated: anyMarksSourceUpdated,
        },
      };
    });
  },

  /**
   * 3. Preview Attendance Release
   * Validates consolidated register, calculates stats, and returns a verified preview.
   */
  async previewAttendanceRelease(params: {
    departmentId: string;
    isSemesterHandling: boolean;
    semester: number;
    academicYear: string;
    subjectId: string;
  }) {
    const { departmentId, isSemesterHandling, semester, academicYear, subjectId } = params;
    const cleanAY = academicYear.trim();

    const subject = await Subject.findByPk(subjectId);
    if (!subject) throw new Error('Subject not found.');

    const department = await Department.findByPk(departmentId);
    if (!department) throw new Error('Department not found.');

    // 1. Fetch Consolidated Semester Data (Authoritative)
    const consData = await semesterAttendanceConsolidationService.fetchConsolidatedSemesterData({
      academicYear: cleanAY,
      departmentId,
      semester,
    });

    // Check if subject exists in the consolidated register
    const hasSubject = consData.subjects.some((s) => s.id === subjectId || s.code.toUpperCase() === subject.code.toUpperCase());
    if (!hasSubject) {
      throw new Error(`Subject ${subject.code} (${subject.name}) is not mapped to the consolidated register for Semester ${semester}.`);
    }

    // 2. Discover Drive file status
    const backupRecord = await ConsolidatedAttendanceBackupFile.findOne({
      where: {
        academicYear: cleanAY,
        departmentId,
        semester,
      },
    });

    // 3. Extract student records specifically for this subject
    let eligibleCount = 0;
    let shortageCount = 0;
    let missingCount = 0;
    let sumPercentage = 0;
    let countedStudents = 0;

    const studentRows = consData.students.map((st, idx) => {
      const stats = st.subjectStats[subjectId] || st.subjectStats[subject.code] || null;

      let conducted = stats ? stats.conducted : 0;
      let attended = stats ? stats.attended : 0;
      let percentage = stats ? stats.percentage : null;

      if (percentage === null || conducted === 0) {
        missingCount++;
      } else {
        countedStudents++;
        sumPercentage += percentage;
        if (percentage >= 85.0) { // VTU standard / default threshold
          eligibleCount++;
        } else {
          shortageCount++;
        }
      }

      return {
        sl: idx + 1,
        studentId: st.id,
        usn: st.usn,
        name: st.name,
        section: st.section,
        conducted,
        attended,
        percentage,
        eligibility: percentage !== null ? (percentage >= 85.0 ? 'Eligible' : 'Not Eligible') : 'No Records',
      };
    });

    const averagePercentage = countedStudents > 0 ? Number((sumPercentage / countedStudents).toFixed(2)) : null;

    // Check existing release
    const existingRelease = await AcademicRelease.findOne({
      where: {
        departmentId,
        academicYear: cleanAY,
        semester,
        subjectId,
        releaseType: 'ATTENDANCE',
        assessmentType: 'ATTENDANCE',
      },
      include: [{ model: User, as: 'releasedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    });

    const currentFingerprint = generateDataFingerprint({
      subjectCode: subject.code,
      cleanAY,
      semester,
      studentCounts: studentRows.map((s) => ({ usn: s.usn, pct: s.percentage, c: s.conducted, a: s.attended })),
    });

    const isAlreadyReleased = Boolean(existingRelease && existingRelease.status === 'RELEASED');
    const isSourceUpdated = Boolean(isAlreadyReleased && existingRelease?.sourceFingerprint && existingRelease.sourceFingerprint !== currentFingerprint);

    return {
      sourceInfo: {
        fileName: consData.fileName,
        googleDriveFileId: backupRecord?.googleDriveFileId || null,
        googleDriveFileUrl: backupRecord?.googleDriveFileUrl || null,
        sourceType: backupRecord?.googleDriveFileId ? 'GOOGLE_DRIVE' : 'SYSTEM_CONSOLIDATED',
        lastSyncedAt: backupRecord?.lastSyncedAt || null,
        fingerprint: currentFingerprint,
      },
      subject: {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        credits: subject.credits,
        semester,
        academicYear: cleanAY,
      },
      stats: {
        totalStudents: studentRows.length,
        eligibleCount,
        shortageCount,
        missingCount,
        averagePercentage,
      },
      students: studentRows,
      validation: {
        isValid: studentRows.length > 0 && countedStudents > 0,
        warnings: missingCount > 0 ? [`${missingCount} students currently have no attendance records conducted.`] : [],
        errors: studentRows.length === 0 ? ['No students enrolled in this cohort.'] : [],
      },
      isAlreadyReleased,
      isSourceUpdated,
      currentRelease: existingRelease
        ? {
            id: existingRelease.id,
            releasedAt: existingRelease.releasedAt,
            releasedBy: existingRelease.releasedByUser
              ? `${existingRelease.releasedByUser.firstName || ''} ${existingRelease.releasedByUser.lastName || ''}`.trim()
              : null,
          }
        : null,
    };
  },

  /**
   * 4. Confirm Attendance Release
   * Atomically releases attendance for the subject and publishes student records.
   */
  async confirmAttendanceRelease(params: {
    departmentId: string;
    isSemesterHandling: boolean;
    semester: number;
    academicYear: string;
    subjectId: string;
    userId: string;
  }) {
    const { departmentId, isSemesterHandling, semester, academicYear, subjectId, userId } = params;
    const cleanAY = academicYear.trim();

    const preview = await this.previewAttendanceRelease({
      departmentId,
      isSemesterHandling,
      semester,
      academicYear: cleanAY,
      subjectId,
    });

    if (!preview.validation.isValid && preview.validation.errors.length > 0) {
      throw new Error(`Cannot release attendance: ${preview.validation.errors.join(', ')}`);
    }

    // Atomic transaction
    return sequelize.transaction(async (t) => {
      // 1. Upsert AcademicRelease record
      const [release] = await AcademicRelease.upsert(
        {
          departmentId,
          academicYear: cleanAY,
          semester,
          subjectId,
          releaseType: 'ATTENDANCE',
          assessmentType: 'ATTENDANCE',
          status: 'RELEASED',
          sourceType: preview.sourceInfo.googleDriveFileId ? 'GOOGLE_DRIVE' : 'SYSTEM',
          googleDriveFileId: preview.sourceInfo.googleDriveFileId,
          googleDriveFileName: preview.sourceInfo.fileName,
          sourceFingerprint: preview.sourceInfo.fingerprint,
          totalStudentsCount: preview.students.length,
          releasedByUserId: userId,
          releasedAt: new Date(),
          lastReviewedAt: new Date(),
          metadata: {
            averagePercentage: preview.stats.averagePercentage,
            eligibleCount: preview.stats.eligibleCount,
            shortageCount: preview.stats.shortageCount,
          },
        },
        { transaction: t, returning: true }
      );

      // 2. Upsert StudentReleasedAcademicData records
      const studentRecords = preview.students.map((st) => ({
        academicReleaseId: release.id,
        studentId: st.studentId,
        usn: st.usn,
        studentName: st.name,
        subjectId,
        semester,
        academicYear: cleanAY,
        releaseType: 'ATTENDANCE' as const,
        assessmentType: 'ATTENDANCE',
        attendancePercentage: st.percentage,
        conductedClasses: st.conducted,
        attendedClasses: st.attended,
        status: st.eligibility,
      }));

      // Bulk upsert student records
      for (const rec of studentRecords) {
        await StudentReleasedAcademicData.upsert(rec, { transaction: t });
      }

      logger.info(
        `✓ [AcademicRelease] Attendance released for ${preview.subject.code} (Semester ${semester}, AY ${cleanAY}) by user ${userId}. ${studentRecords.length} students published.`
      );

      return {
        success: true,
        message: `Attendance for ${preview.subject.code} - ${preview.subject.name} released successfully.`,
        releaseId: release.id,
        releasedAt: release.releasedAt,
        totalStudentsCount: studentRecords.length,
      };
    });
  },

  /**
   * 5. Preview Marks Release for Individual Assessment
   * Authoritative Source: Direct PostgreSQL database models
   * (StudentAssessmentSummary, StudentAssignmentSummary, FinalInternalMarks, ExternalExaminationMarks)
   */
  async previewMarksRelease(params: {
    departmentId: string;
    isSemesterHandling: boolean;
    semester: number;
    academicYear: string;
    subjectId: string;
    assessmentType: AssessmentType;
  }) {
    const { departmentId, isSemesterHandling, semester, academicYear, subjectId, assessmentType } = params;
    const cleanAY = academicYear.trim();
    const ayVariants = getAYVariants(cleanAY);
    const ayFilter = ayVariants.length > 0 ? { [Op.in]: ayVariants } : cleanAY;

    const def = SUPPORTED_ASSESSMENT_TYPES.find((a) => a.type === assessmentType);
    if (!def) {
      throw new Error(`Unsupported assessment type: ${assessmentType}`);
    }

    const subject = await Subject.findByPk(subjectId);
    if (!subject) throw new Error('Subject not found.');

    const department = await Department.findByPk(departmentId);
    if (!department) throw new Error('Department not found.');

    const isSemHandling = Boolean(
      isSemesterHandling ||
      department.type === 'SEMESTER_HANDLING' ||
      department.code === 'AS'
    );

    // 1. Fetch Cohort Students directly from Database
    let dbStudents: Student[] = [];

    // Query active sections for this AY & Semester to respect allocated students
    const sectionWhere: any = {
      semester,
      status: 'ACTIVE',
    };
    if (cleanAY) {
      sectionWhere.academicYear = cleanAY;
    }
    if (!isSemHandling) {
      sectionWhere.departmentId = departmentId;
    }

    const dbSections = await Section.findAll({ where: sectionWhere });
    if (dbSections.length > 0) {
      const secIds = dbSections.map((s) => s.id);
      const studentWhere: any = {
        semester,
        [Op.or]: [
          { sectionId: { [Op.in]: secIds } },
          { section: { [Op.in]: dbSections.map((s) => s.name) } },
        ],
      };
      if (!isSemHandling) {
        studentWhere.departmentId = departmentId;
      }
      dbStudents = await Student.findAll({
        where: studentWhere,
        include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
        order: [['usn', 'ASC'], ['enrollmentNumber', 'ASC']],
      });
    }

    // Fallback: If section mapping yielded 0 students, query all students matching semester & scope
    if (dbStudents.length === 0) {
      const fallbackWhere: any = { semester };
      if (!isSemHandling) {
        fallbackWhere.departmentId = departmentId;
      }
      dbStudents = await Student.findAll({
        where: fallbackWhere,
        include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
        order: [['usn', 'ASC'], ['enrollmentNumber', 'ASC']],
      });
    }

    // Deduplicate students by ID
    const studentMap = new Map<string, Student>();
    for (const st of dbStudents) {
      if (!studentMap.has(st.id)) {
        studentMap.set(st.id, st);
      }
    }
    const uniqueStudents = Array.from(studentMap.values());

    // 2. Fetch Authoritative Marks directly from Database models
    let maxMarks = def.defaultMaxMarks;
    const marksByStudentId = new Map<string, number | null>();

    if (assessmentType === 'CIE1' || assessmentType === 'CIE2') {
      const cfgWhere: any = {
        subjectId,
        semester,
        academicYear: ayFilter,
        assessmentType,
      };
      if (!isSemHandling) {
        cfgWhere.departmentId = departmentId;
      }
      let cieConfig = await AssessmentConfiguration.findOne({ where: cfgWhere });
      if (!cieConfig && isSemHandling) {
        cieConfig = await AssessmentConfiguration.findOne({
          where: { subjectId, semester, academicYear: ayFilter, assessmentType },
        });
      }

      if (cieConfig) {
        maxMarks = Number(cieConfig.maximumMarks) || 50;
        const summaries = await StudentAssessmentSummary.findAll({
          where: { assessmentConfigurationId: cieConfig.id },
        });
        for (const sum of summaries) {
          if (sum.finalCieMarks !== null && sum.finalCieMarks !== undefined) {
            marksByStudentId.set(sum.studentId, Number(sum.finalCieMarks));
          }
        }
      }
    } else if (assessmentType === 'ASSIGNMENT') {
      const cfgWhere: any = {
        subjectId,
        semester,
        academicYear: ayFilter,
      };
      if (!isSemHandling) {
        cfgWhere.departmentId = departmentId;
      }
      let assignConfig = await AssignmentConfiguration.findOne({ where: cfgWhere });
      if (!assignConfig && isSemHandling) {
        assignConfig = await AssignmentConfiguration.findOne({
          where: { subjectId, semester, academicYear: ayFilter },
        });
      }

      if (assignConfig) {
        maxMarks = Number(assignConfig.maximumMarks) || 25;
        const summaries = await StudentAssignmentSummary.findAll({
          where: { assignmentConfigurationId: assignConfig.id },
        });
        for (const sum of summaries) {
          const val =
            sum.scaledTotal !== null && sum.scaledTotal !== undefined
              ? Number(sum.scaledTotal)
              : sum.rawTotal !== null && sum.rawTotal !== undefined
              ? Number(sum.rawTotal)
              : null;
          if (val !== null) {
            marksByStudentId.set(sum.studentId, val);
          }
        }
      }
    } else if (assessmentType === 'FINAL_INTERNAL') {
      maxMarks = 50;
      const finWhere: any = {
        subjectId,
        semester,
        academicYear: ayFilter,
      };
      if (!isSemHandling) {
        finWhere.departmentId = departmentId;
      }
      let finRecords = await FinalInternalMarks.findAll({ where: finWhere });
      if (finRecords.length === 0 && isSemHandling) {
        finRecords = await FinalInternalMarks.findAll({
          where: { subjectId, semester, academicYear: ayFilter },
        });
      }
      for (const rec of finRecords) {
        if (rec.finalInternalMarks !== null && rec.finalInternalMarks !== undefined) {
          marksByStudentId.set(rec.studentId, Number(rec.finalInternalMarks));
          if (rec.maxFinalInternalMarks) {
            maxMarks = Number(rec.maxFinalInternalMarks);
          }
        }
      }
    } else if (assessmentType === 'EXTERNAL') {
      maxMarks = 100;
      const extWhere: any = {
        subjectId,
        semester,
        academicYear: ayFilter,
      };
      if (!isSemHandling) {
        extWhere.departmentId = departmentId;
      }
      let extRecords = await ExternalExaminationMarks.findAll({ where: extWhere });
      if (extRecords.length === 0 && isSemHandling) {
        extRecords = await ExternalExaminationMarks.findAll({
          where: { subjectId, semester, academicYear: ayFilter },
        });
      }
      for (const rec of extRecords) {
        if (rec.externalMarks !== null && rec.externalMarks !== undefined) {
          marksByStudentId.set(rec.studentId, Number(rec.externalMarks));
          if (rec.maximumMarks) {
            maxMarks = Number(rec.maximumMarks);
          }
        }
      }
    }

    // 3. Check Google Drive Backup File (for source tracking and optional Excel fallback)
    const backupFile = await MarksBackupFile.findOne({
      where: {
        academicYear: cleanAY,
        departmentId,
        semester,
        subjectId,
      },
    });
    const driveFileName =
      backupFile?.fileName ||
      `${subject.code}_${subject.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;

    // Secondary fallback: If database models yielded 0 entered marks, attempt parsing existing workbook
    if (marksByStudentId.size === 0) {
      let workbookBuffer: Buffer | null = null;
      if (backupFile?.googleDriveFileId) {
        try {
          workbookBuffer = await googleDriveService.downloadFileBuffer(backupFile.googleDriveFileId);
        } catch (dErr: any) {
          logger.warn(`Could not read marks workbook from Drive: ${dErr.message}`);
        }
      }

      if (workbookBuffer) {
        try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(workbookBuffer as any);
          const worksheet = workbook.getWorksheet(def.sheetName);
          if (worksheet) {
            let targetMarkCol = 4;
            if (assessmentType === 'CIE1' || assessmentType === 'CIE2') {
              targetMarkCol = worksheet.columnCount || 10;
              const r5 = worksheet.getRow(5);
              r5.eachCell((cell, colNum) => {
                const val = String(cell.value || '').toLowerCase();
                if (val.includes('final') || val.includes('cie-1') || val.includes('cie-2')) {
                  targetMarkCol = colNum;
                }
              });
            } else if (assessmentType === 'ASSIGNMENT') {
              targetMarkCol = 4;
              const r5 = worksheet.getRow(5);
              r5.eachCell((cell, colNum) => {
                const val = String(cell.value || '').toLowerCase();
                if (val.includes('total') || val.includes('assignment')) {
                  targetMarkCol = colNum;
                }
              });
            } else if (assessmentType === 'FINAL_INTERNAL') {
              targetMarkCol = 9;
            } else if (assessmentType === 'EXTERNAL') {
              targetMarkCol = 5;
            }

            const usnToStudentIdMap = new Map<string, string>();
            for (const st of uniqueStudents) {
              const u = (st.usn || st.enrollmentNumber || '').trim().toUpperCase();
              if (u) usnToStudentIdMap.set(u, st.id);
            }

            for (let rowIdx = 6; rowIdx <= worksheet.rowCount; rowIdx++) {
              const row = worksheet.getRow(rowIdx);
              const usnRaw = String(row.getCell(2).value || '').trim().toUpperCase();
              if (!usnRaw || usnRaw === 'USN' || usnRaw === 'SL. NO.') continue;
              const markCell = row.getCell(targetMarkCol).value;
              if (markCell !== null && markCell !== undefined && String(markCell).trim() !== '' && !isNaN(Number(markCell))) {
                const stId = usnToStudentIdMap.get(usnRaw);
                if (stId) {
                  marksByStudentId.set(stId, Number(markCell));
                }
              }
            }
          }
        } catch (wbErr: any) {
          logger.warn(`Excel fallback parsing skipped: ${wbErr.message}`);
        }
      }
    }

    // 4. Construct Cohort Student Rows
    const studentRows: any[] = [];
    let evaluatedCount = 0;
    let missingCount = 0;
    let sumMarks = 0;
    let highestMarks = -Infinity;
    let lowestMarks = Infinity;

    for (let idx = 0; idx < uniqueStudents.length; idx++) {
      const st = uniqueStudents[idx];
      const usnRaw = (st.usn || st.enrollmentNumber || 'N/A').trim().toUpperCase();
      const nameRaw = st.user
        ? `${st.user.firstName || ''} ${st.user.lastName || ''}`.trim()
        : 'Student';

      let markObtained = marksByStudentId.get(st.id);
      if (markObtained === undefined) {
        markObtained = null;
      }

      if (markObtained !== null && !isNaN(markObtained)) {
        evaluatedCount++;
        sumMarks += markObtained;
        if (markObtained > highestMarks) highestMarks = markObtained;
        if (markObtained < lowestMarks) lowestMarks = markObtained;
      } else {
        missingCount++;
      }

      const percentage =
        markObtained !== null && maxMarks > 0
          ? Number(((markObtained / maxMarks) * 100).toFixed(2))
          : null;

      studentRows.push({
        sl: idx + 1,
        studentId: st.id,
        usn: usnRaw,
        name: nameRaw,
        marksObtained: markObtained,
        maxMarks,
        percentage,
        status:
          markObtained !== null
            ? markObtained >= maxMarks * 0.4
              ? 'PASSED'
              : 'FAILED'
            : 'NOT_ENTERED',
      });
    }

    if (lowestMarks === Infinity) lowestMarks = 0;
    if (highestMarks === -Infinity) highestMarks = 0;
    const averageMarks = evaluatedCount > 0 ? Number((sumMarks / evaluatedCount).toFixed(2)) : 0;

    // Check existing release
    const existingRelease = await AcademicRelease.findOne({
      where: {
        departmentId,
        academicYear: cleanAY,
        semester,
        subjectId,
        releaseType: 'MARKS',
        assessmentType,
      },
      include: [{ model: User, as: 'releasedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    });

    const currentFingerprint = generateDataFingerprint({
      subjectCode: subject.code,
      assessmentType,
      cleanAY,
      semester,
      records: studentRows.map((s) => ({ u: s.usn, m: s.marksObtained })),
    });

    const isAlreadyReleased = Boolean(existingRelease && existingRelease.status === 'RELEASED');
    const isSourceUpdated = Boolean(
      isAlreadyReleased &&
      existingRelease?.sourceFingerprint &&
      existingRelease.sourceFingerprint !== currentFingerprint
    );

    const errors: string[] = [];
    if (studentRows.length === 0) {
      errors.push(`No enrolled students found in the database for Semester ${semester}.`);
    } else if (evaluatedCount === 0) {
      errors.push(
        `No ${def.label} recorded in the database for ${subject.code} (${subject.name}) yet. Please ensure faculty has entered marks before publishing.`
      );
    }

    return {
      sourceInfo: {
        fileName: driveFileName,
        sheetName: def.sheetName,
        googleDriveFileId: backupFile?.googleDriveFileId || null,
        sourceType: backupFile?.googleDriveFileId ? 'GOOGLE_DRIVE' : 'SYSTEM',
        lastSyncedAt: backupFile?.lastSyncedAt || null,
        fingerprint: currentFingerprint,
      },
      subject: {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        semester,
        academicYear: cleanAY,
      },
      assessmentType,
      assessmentLabel: def.label,
      maxMarks,
      stats: {
        totalStudents: studentRows.length,
        evaluatedCount,
        missingCount,
        averageMarks,
        highestMarks,
        lowestMarks,
      },
      students: studentRows,
      validation: {
        isValid: studentRows.length > 0 && evaluatedCount > 0,
        warnings:
          missingCount > 0
            ? [`${missingCount} students do not have marks recorded for this assessment.`]
            : [],
        errors,
      },
      isAlreadyReleased,
      isSourceUpdated,
      currentRelease: existingRelease
        ? {
            id: existingRelease.id,
            releasedAt: existingRelease.releasedAt,
            releasedBy: existingRelease.releasedByUser
              ? `${existingRelease.releasedByUser.firstName || ''} ${existingRelease.releasedByUser.lastName || ''}`.trim()
              : null,
          }
        : null,
    };
  },

  /**
   * 6. Confirm Marks Release for Individual Assessment
   */
  async confirmMarksRelease(params: {
    departmentId: string;
    isSemesterHandling: boolean;
    semester: number;
    academicYear: string;
    subjectId: string;
    assessmentType: AssessmentType;
    userId: string;
  }) {
    const { departmentId, isSemesterHandling, semester, academicYear, subjectId, assessmentType, userId } = params;
    const cleanAY = academicYear.trim();

    const preview = await this.previewMarksRelease({
      departmentId,
      isSemesterHandling,
      semester,
      academicYear: cleanAY,
      subjectId,
      assessmentType,
    });

    if (!preview.validation.isValid && preview.validation.errors.length > 0) {
      throw new Error(`Cannot release marks: ${preview.validation.errors.join(', ')}`);
    }

    return sequelize.transaction(async (t) => {
      // 1. Upsert AcademicRelease record
      const [release] = await AcademicRelease.upsert(
        {
          departmentId,
          academicYear: cleanAY,
          semester,
          subjectId,
          releaseType: 'MARKS',
          assessmentType,
          status: 'RELEASED',
          sourceType: preview.sourceInfo.googleDriveFileId ? 'GOOGLE_DRIVE' : 'SYSTEM',
          googleDriveFileId: preview.sourceInfo.googleDriveFileId,
          googleDriveFileName: preview.sourceInfo.fileName,
          sourceFingerprint: preview.sourceInfo.fingerprint,
          totalStudentsCount: preview.students.length,
          releasedByUserId: userId,
          releasedAt: new Date(),
          lastReviewedAt: new Date(),
          metadata: {
            assessmentLabel: preview.assessmentLabel,
            maxMarks: preview.maxMarks,
            averageMarks: preview.stats.averageMarks,
            evaluatedCount: preview.stats.evaluatedCount,
          },
        },
        { transaction: t, returning: true }
      );

      // 2. Upsert StudentReleasedAcademicData records
      const studentRecords = preview.students
        .filter((st) => st.studentId) // Only write records for resolved students
        .map((st) => ({
          academicReleaseId: release.id,
          studentId: st.studentId,
          usn: st.usn,
          studentName: st.name,
          subjectId,
          semester,
          academicYear: cleanAY,
          releaseType: 'MARKS' as const,
          assessmentType,
          marksObtained: st.marksObtained,
          maxMarks: preview.maxMarks,
          percentage: st.percentage,
          status: st.status,
        }));

      for (const rec of studentRecords) {
        await StudentReleasedAcademicData.upsert(rec, { transaction: t });
      }

      logger.info(
        `✓ [AcademicRelease] ${preview.assessmentLabel} released for ${preview.subject.code} (Semester ${semester}, AY ${cleanAY}) by user ${userId}. ${studentRecords.length} students published.`
      );

      const result = {
        success: true,
        message: `${preview.assessmentLabel} for ${preview.subject.code} - ${preview.subject.name} released successfully.`,
        releaseId: release.id,
        releasedAt: release.releasedAt,
        totalStudentsCount: studentRecords.length,
      };

      bitwiseMarksBackupQueueService
        .queueMarksBackup(subjectId, semester, cleanAY, departmentId, 'UPDATE')
        .catch((bErr: any) => logger.warn('[AcademicRelease] Marks backup queue notice:', bErr.message));

      return result;
    });
  },

  /**
   * 7. Global Semester Attendance Release
   * Releases attendance for all active subjects in a semester with zero modal prompts.
   */
  async confirmSemesterAttendanceRelease(params: {
    departmentId: string;
    isSemesterHandling: boolean;
    semester: number;
    academicYear: string;
    userId: string;
  }) {
    const { departmentId, isSemesterHandling, semester, academicYear, userId } = params;
    const cleanAY = academicYear.trim();

    const subjects = await this.getRawActiveSubjects(departmentId, isSemesterHandling, semester);
    if (subjects.length === 0) {
      throw new Error(`No active subjects found for Semester ${semester}.`);
    }

    const releasedCodes: string[] = [];
    const skippedList: Array<{ code: string; reason: string }> = [];
    let totalStudentsPublished = 0;

    for (const sub of subjects) {
      try {
        const res = await this.confirmAttendanceRelease({
          departmentId,
          isSemesterHandling,
          semester,
          academicYear: cleanAY,
          subjectId: sub.id,
          userId,
        });
        releasedCodes.push(sub.code);
        totalStudentsPublished += res.totalStudentsCount || 0;
      } catch (err: any) {
        logger.warn(`[AcademicRelease] Could not release attendance for ${sub.code}:`, err.message);
        skippedList.push({ code: sub.code, reason: err.message });
      }
    }

    if (releasedCodes.length === 0 && skippedList.length > 0) {
      throw new Error(`Failed to release attendance: ${skippedList.map((s) => `${s.code} (${s.reason})`).join(', ')}`);
    }

    return {
      success: true,
      message: `Attendance released successfully for ${releasedCodes.length} of ${subjects.length} subjects in Semester ${semester}.`,
      releasedCount: releasedCodes.length,
      totalSubjects: subjects.length,
      releasedCodes,
      skippedList,
      totalStudentsPublished,
    };
  },

  /**
   * 8. Revoke Semester Attendance Release
   */
  async revokeSemesterAttendanceRelease(params: {
    departmentId: string;
    semester: number;
    academicYear: string;
  }) {
    const { departmentId, semester, academicYear } = params;
    const cleanAY = academicYear.trim();

    await sequelize.transaction(async (t) => {
      const releases = await AcademicRelease.findAll({
        where: {
          departmentId,
          semester,
          academicYear: cleanAY,
          releaseType: 'ATTENDANCE',
        },
        transaction: t,
      });

      const releaseIds = releases.map((r) => r.id);
      if (releaseIds.length > 0) {
        await StudentReleasedAcademicData.destroy({
          where: { academicReleaseId: { [Op.in]: releaseIds } },
          transaction: t,
        });
        await AcademicRelease.destroy({
          where: { id: { [Op.in]: releaseIds } },
          transaction: t,
        });
      }
    });

    return {
      success: true,
      message: `Attendance publication revoked for Semester ${semester}. Records concealed from student dashboards.`,
    };
  },

  /**
   * 9. Global Semester Marks Release
   * Releases marks for all active subjects in a semester with zero modal prompts.
   */
  async confirmSemesterMarksRelease(params: {
    departmentId: string;
    isSemesterHandling: boolean;
    semester: number;
    academicYear: string;
    assessmentType?: 'ALL' | AssessmentType;
    userId: string;
  }) {
    const { departmentId, isSemesterHandling, semester, academicYear, assessmentType = 'ALL', userId } = params;
    const cleanAY = academicYear.trim();

    const subjects = await this.getRawActiveSubjects(departmentId, isSemesterHandling, semester);
    if (subjects.length === 0) {
      throw new Error(`No active subjects found for Semester ${semester}.`);
    }

    const typesToRelease: AssessmentType[] =
      assessmentType === 'ALL'
        ? (SUPPORTED_ASSESSMENT_TYPES.map((a) => a.type) as AssessmentType[])
        : [assessmentType as AssessmentType];

    const releasedList: Array<{ subject: string; assessment: string }> = [];
    const skippedList: Array<{ subject: string; assessment: string; reason: string }> = [];
    let totalStudentsPublished = 0;

    for (const sub of subjects) {
      for (const aType of typesToRelease) {
        try {
          const res = await this.confirmMarksRelease({
            departmentId,
            isSemesterHandling,
            semester,
            academicYear: cleanAY,
            subjectId: sub.id,
            assessmentType: aType,
            userId,
          });
          releasedList.push({ subject: sub.code, assessment: aType });
          totalStudentsPublished += res.totalStudentsCount || 0;
        } catch (err: any) {
          skippedList.push({ subject: sub.code, assessment: aType, reason: err.message });
        }
      }
    }

    if (releasedList.length === 0 && skippedList.length > 0) {
      throw new Error(`Failed to release marks: ${skippedList.map((s) => `${s.subject}:${s.assessment} (${s.reason})`).join(', ')}`);
    }

    return {
      success: true,
      message: `Evaluation marks released successfully (${releasedList.length} assessment sets published).`,
      releasedCount: releasedList.length,
      released: releasedList,
      skipped: skippedList,
      totalStudentsPublished,
    };
  },

  /**
   * 10. Revoke Semester Marks Release
   */
  async revokeSemesterMarksRelease(params: {
    departmentId: string;
    semester: number;
    academicYear: string;
    assessmentType?: string;
  }) {
    const { departmentId, semester, academicYear, assessmentType } = params;
    const cleanAY = academicYear.trim();

    await sequelize.transaction(async (t) => {
      const whereClause: any = {
        departmentId,
        semester,
        academicYear: cleanAY,
        releaseType: 'MARKS',
      };
      if (assessmentType && assessmentType !== 'ALL') {
        whereClause.assessmentType = assessmentType;
      }

      const releases = await AcademicRelease.findAll({
        where: whereClause,
        transaction: t,
      });

      const releaseIds = releases.map((r) => r.id);
      if (releaseIds.length > 0) {
        await StudentReleasedAcademicData.destroy({
          where: { academicReleaseId: { [Op.in]: releaseIds } },
          transaction: t,
        });
        await AcademicRelease.destroy({
          where: { id: { [Op.in]: releaseIds } },
          transaction: t,
        });
      }
    });

    return {
      success: true,
      message: `Marks publication revoked for Semester ${semester}. Records concealed from student dashboards.`,
    };
  },

  /**
   * 11. Revoke Subject Attendance Release
   */
  async revokeSubjectAttendanceRelease(params: {
    departmentId: string;
    semester: number;
    academicYear: string;
    subjectId: string;
  }) {
    const { departmentId, semester, academicYear, subjectId } = params;
    const cleanAY = academicYear.trim();

    await sequelize.transaction(async (t) => {
      const releases = await AcademicRelease.findAll({
        where: {
          departmentId,
          semester,
          academicYear: cleanAY,
          subjectId,
          releaseType: 'ATTENDANCE',
        },
        transaction: t,
      });

      const releaseIds = releases.map((r) => r.id);
      if (releaseIds.length > 0) {
        await StudentReleasedAcademicData.destroy({
          where: { academicReleaseId: { [Op.in]: releaseIds } },
          transaction: t,
        });
        await AcademicRelease.destroy({
          where: { id: { [Op.in]: releaseIds } },
          transaction: t,
        });
      }
    });

    return {
      success: true,
      message: 'Attendance publication revoked successfully for subject.',
    };
  },

  /**
   * 12. Revoke Subject Marks Release
   */
  async revokeSubjectMarksRelease(params: {
    departmentId: string;
    semester: number;
    academicYear: string;
    subjectId: string;
    assessmentType?: string;
  }) {
    const { departmentId, semester, academicYear, subjectId, assessmentType } = params;
    const cleanAY = academicYear.trim();

    await sequelize.transaction(async (t) => {
      const whereClause: any = {
        departmentId,
        semester,
        academicYear: cleanAY,
        subjectId,
        releaseType: 'MARKS',
      };
      if (assessmentType && assessmentType !== 'ALL') {
        whereClause.assessmentType = assessmentType;
      }

      const releases = await AcademicRelease.findAll({
        where: whereClause,
        transaction: t,
      });

      const releaseIds = releases.map((r) => r.id);
      if (releaseIds.length > 0) {
        await StudentReleasedAcademicData.destroy({
          where: { academicReleaseId: { [Op.in]: releaseIds } },
          transaction: t,
        });
        await AcademicRelease.destroy({
          where: { id: { [Op.in]: releaseIds } },
          transaction: t,
        });
      }
    });

    return {
      success: true,
      message: 'Marks publication revoked successfully for subject.',
    };
  },
};

export default academicReleaseService;
