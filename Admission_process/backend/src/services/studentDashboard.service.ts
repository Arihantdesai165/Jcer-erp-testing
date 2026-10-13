import { Op } from 'sequelize';
import sequelize from '../config/database';
import Student from '../models/Student';
import User from '../models/User';
import Department from '../models/Department';
import Section from '../models/Section';
import Subject from '../models/Subject';
import AttendanceRecord from '../models/AttendanceRecord';
import AttendanceSession from '../models/AttendanceSession';
import AssessmentConfiguration from '../models/AssessmentConfiguration';
import StudentAssessmentSummary from '../models/StudentAssessmentSummary';
import Admission from '../models/Admission';
import AdmissionPersonalDetail from '../models/AdmissionPersonalDetail';
import AdmissionParentDetail from '../models/AdmissionParentDetail';
import AdmissionAddress from '../models/AdmissionAddress';
import AdmissionAcademicDetail from '../models/AdmissionAcademicDetail';
import StudentReleasedAcademicData from '../models/StudentReleasedAcademicData';
import AcademicRelease from '../models/AcademicRelease';
import logger from '../utils/logger.util';

export interface ResolvedStudentContext {
  user: User;
  student: Student | null;
  admission: Admission | null;
  isAdmissionApplicant: boolean;
}

class StudentDashboardService {
  /**
   * Resolves unified student context: handles enrolled students, auto-linking, and admission applicants
   */
  async resolveStudentContext(userId: string): Promise<ResolvedStudentContext> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User account not found.');
    }

    // 1. Direct Student query by userId
    let student = await Student.findOne({
      where: { userId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'middleName', 'lastName', 'email', 'phone', 'profileImage', 'gender'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code', 'type'] },
        { model: Section, as: 'sectionEntity', attributes: ['id', 'name'] },
      ],
    });

    // 2. Fetch Admission record for user
    let admission = await Admission.findOne({
      where: { userId },
      include: [
        { model: Department, as: 'branch', attributes: ['id', 'name', 'code'] },
        { model: AdmissionPersonalDetail, as: 'studentpersonaldetails' },
        { model: AdmissionParentDetail, as: 'studentparentdetails' },
        { model: AdmissionAddress, as: 'studentaddress' },
        { model: AdmissionAcademicDetail, as: 'studentacademicdetails' },
      ],
    });

    // 3. Fallback resolution: link unlinked Student if matching by user's email or admission identifiers
    if (!student && user.email) {
      const linkedUserIds = (await User.findAll({
        where: { email: user.email.toLowerCase() },
        attributes: ['id'],
      })).map((u) => u.id);

      const unlinkedStudent = await Student.findOne({
        where: {
          userId: { [Op.in]: linkedUserIds },
        },
        include: [
          { model: User, as: 'user', attributes: ['id', 'firstName', 'middleName', 'lastName', 'email', 'phone', 'profileImage', 'gender'] },
          { model: Department, as: 'department', attributes: ['id', 'name', 'code', 'type'] },
          { model: Section, as: 'sectionEntity', attributes: ['id', 'name'] },
        ],
      });

      if (unlinkedStudent) {
        student = unlinkedStudent;
      }
    }

    // 4. Fallback resolution: find Student by admission applicationNumber or CET/DCET number
    if (!student && admission) {
      const matchConditions: any[] = [];
      if (admission.applicationNumber) {
        matchConditions.push({ enrollmentNumber: admission.applicationNumber });
      }
      if (admission.cetNumber) {
        matchConditions.push({ usn: admission.cetNumber });
      }
      if (matchConditions.length > 0) {
        const matchingStudent = await Student.findOne({
          where: { [Op.or]: matchConditions },
          include: [
            { model: User, as: 'user', attributes: ['id', 'firstName', 'middleName', 'lastName', 'email', 'phone', 'profileImage', 'gender'] },
            { model: Department, as: 'department', attributes: ['id', 'name', 'code', 'type'] },
            { model: Section, as: 'sectionEntity', attributes: ['id', 'name'] },
          ],
        });
        if (matchingStudent) {
          if (!matchingStudent.userId) {
            await matchingStudent.update({ userId: user.id });
          }
          student = matchingStudent;
        }
      }
    }

    // 5. Fallback resolution: find Admission by Student enrollmentNumber/USN or email
    if (!admission && student) {
      const orConds: any[] = [];
      if (student.enrollmentNumber) orConds.push({ applicationNumber: student.enrollmentNumber });
      if (student.usn) orConds.push({ cetNumber: student.usn }, { dcetNumber: student.usn });
      if (user.email) orConds.push({ email: user.email.toLowerCase() });
      if (orConds.length > 0) {
        admission = await Admission.findOne({
          where: { [Op.or]: orConds },
          include: [
            { model: Department, as: 'branch', attributes: ['id', 'name', 'code'] },
            { model: AdmissionPersonalDetail, as: 'studentpersonaldetails' },
            { model: AdmissionParentDetail, as: 'studentparentdetails' },
            { model: AdmissionAddress, as: 'studentaddress' },
            { model: AdmissionAcademicDetail, as: 'studentacademicdetails' },
          ],
        });
      }
    }

    const isAdmissionApplicant = !student;

    return {
      user,
      student,
      admission,
      isAdmissionApplicant,
    };
  }

  /**
   * Resolves the authenticated Student record from the authenticated user's ID
   */
  async getStudentByUserId(userId: string): Promise<Student> {
    const { student } = await this.resolveStudentContext(userId);

    if (!student) {
      throw new Error('No student academic record associated with this account. Please contact the administrator.');
    }

    return student;
  }

  /**
   * Overview: Academic summary, overall attendance, subject attendance, and published marks
   */
  async getStudentOverview(userId: string): Promise<any> {
    const { user, student, admission, isAdmissionApplicant } = await this.resolveStudentContext(userId);

    // ── ADMISSION APPLICANT ONLY (PRE-ENROLLMENT) ─────────────────────────────
    if (isAdmissionApplicant) {
      const pd = (admission as any)?.studentpersonaldetails || {};
      const branch = (admission as any)?.branch || {};
      const studentName = `${pd.firstName || user.firstName || ''} ${pd.middleName || user.middleName || ''} ${pd.lastName || user.lastName || ''}`.replace(/\s+/g, ' ').trim() || user.username || 'Student';

      return {
        student: {
          id: user.id,
          name: studentName,
          usn: admission?.cetNumber || admission?.applicationNumber || 'PENDING',
          enrollmentNumber: admission?.applicationNumber || 'N/A',
          email: user.email,
          department: {
            id: branch.id || '',
            name: branch.name || 'Branch Allocation Pending',
            code: branch.code || 'N/A',
          },
          departmentName: branch.name || 'Branch Allocation Pending',
          departmentCode: branch.code || 'N/A',
          program: 'B.E. (Bachelor of Engineering)',
          semester: admission?.entrySemester || 1,
          section: 'Unassigned',
          academicYear: admission?.academicYear || '2026-27',
          profileImage: user.profileImage || null,
          batch: admission?.academicYear || '2026-27',
        },
        attendanceSummary: {
          totalClasses: 0,
          attendedClasses: 0,
          absentClasses: 0,
          excusedClasses: 0,
          overallPercentage: 0,
          subjects: [],
        },
        publishedMarksSummary: {
          totalAssessmentsPublished: 0,
          assessments: [],
        },
        recentAcademicUpdates: [],
        attendance: {
          overallPercentage: 0,
          totalClasses: 0,
          attendedClasses: 0,
          absentClasses: 0,
          subjectSummary: [],
        },
        marks: {
          publishedCount: 0,
          publishedMarks: [],
          publicationStatuses: [],
        },
        isAdmissionApplicant: true,
        admissionStatus: admission?.applicationStatus || 'DRAFT',
        applicationNumber: admission?.applicationNumber || 'N/A',
        admissionDashboardUrl: '/admission/dashboard',
        notice: 'Your admission application is currently active. Academic classes, daily attendance, and Continuous Internal Evaluation marks will activate upon semester commencement and enrollment finalization.',
      };
    }

    // ── ENROLLED STUDENT ACADEMIC OVERVIEW ─────────────────────────────────────
    const s = student!;
    const u = s.user || user || {};
    const d = s.department || {};

    const studentName = `${u.firstName || ''} ${u.middleName || ''} ${u.lastName || ''}`.replace(/\s+/g, ' ').trim() || 'Student';

    // 1. Authoritative released attendance from HOD release module
    const releasedAttendance = await StudentReleasedAcademicData.findAll({
      where: {
        studentId: s.id,
        releaseType: 'ATTENDANCE',
      },
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code', 'credits'] }],
      order: [['createdAt', 'DESC']],
    });

    let overallAttendancePercentage = 0;
    let totalSessions = 0;
    let attendedSessions = 0;
    let absentSessions = 0;
    const subjectAttendanceSummary: any[] = [];

    if (releasedAttendance.length > 0) {
      for (const rec of releasedAttendance) {
        const cond = rec.conductedClasses || 0;
        const att = rec.attendedClasses || 0;
        totalSessions += cond;
        attendedSessions += att;
        absentSessions += Math.max(0, cond - att);
        const subj = rec.subject as any;
        const pct = rec.attendancePercentage !== null ? Number(rec.attendancePercentage) : 0;
        subjectAttendanceSummary.push({
          subjectId: rec.subjectId,
          subjectCode: subj?.code || 'N/A',
          subjectName: subj?.name || 'N/A',
          totalClasses: cond,
          attendedClasses: att,
          absentClasses: Math.max(0, cond - att),
          totalSessions: cond,
          attendedSessions: att,
          absentSessions: Math.max(0, cond - att),
          percentage: pct,
          status: pct >= 85 ? ('Eligible' as const) : ('Shortage' as const),
          releaseStatus: 'RELEASED',
        });
      }
      overallAttendancePercentage = totalSessions > 0
        ? Number(((attendedSessions / totalSessions) * 100).toFixed(1))
        : 0;
    }

    // 2. Authoritative released marks from HOD release module
    const releasedMarks = await StudentReleasedAcademicData.findAll({
      where: {
        studentId: s.id,
        releaseType: 'MARKS',
      },
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }],
      order: [['createdAt', 'DESC']],
    });

    const publishedMarksSummary = releasedMarks.map((rm) => {
      const subj = rm.subject as any;
      return {
        id: rm.id,
        assessmentId: rm.id,
        assessmentName: rm.assessmentType,
        assessmentType: rm.assessmentType,
        subjectCode: subj?.code || 'N/A',
        subjectName: subj?.name || 'N/A',
        semester: rm.semester,
        maximumMarks: Number(rm.maxMarks || 0),
        marksObtained: Number(rm.marksObtained || 0),
        percentage: Number(rm.percentage || 0),
        publishedAt: (rm as any).createdAt ? (rm as any).createdAt.toISOString() : new Date().toISOString(),
      };
    });

    const assessmentPublicationStatus = releasedMarks.map((rm) => {
      const subj = rm.subject as any;
      return {
        assessmentType: rm.assessmentType,
        subjectCode: subj?.code || 'N/A',
        subjectName: subj?.name || 'N/A',
        isPublished: true,
        statusLabel: 'Official Release',
        publishedAt: (rm as any).createdAt,
      };
    });

    // 3. Recent academic updates timeline
    const recentAcademicUpdates: Array<{
      type: 'ATTENDANCE' | 'MARKS';
      title: string;
      subjectCode: string;
      timestamp: string;
      details: string;
    }> = publishedMarksSummary.slice(0, 3).map((p) => ({
      type: 'MARKS',
      title: `${p.assessmentType} Results Released`,
      subjectCode: p.subjectCode || 'N/A',
      timestamp: p.publishedAt,
      details: `Scored ${p.marksObtained} / ${p.maximumMarks} (${p.percentage}%)`,
    }));

    return {
      student: {
        id: s.id,
        name: studentName,
        usn: s.usn || 'N/A',
        enrollmentNumber: s.enrollmentNumber || 'N/A',
        email: u.email || user.email,
        department: {
          id: d.id || '',
          name: d.name || 'N/A',
          code: d.code || 'N/A',
        },
        departmentName: d.name || 'N/A',
        departmentCode: d.code || 'N/A',
        program: 'B.E. (Bachelor of Engineering)',
        semester: s.semester,
        academicYear: s.currentAcademicYear || '2026-27',
        section: (s as any).sectionEntity?.name || s.section || 'N/A',
        profileImage: u.profileImage || null,
        batch: s.batch,
      },
      attendanceSummary: {
        totalClasses: totalSessions,
        attendedClasses: attendedSessions,
        absentClasses: absentSessions,
        excusedClasses: 0,
        overallPercentage: overallAttendancePercentage,
        subjects: subjectAttendanceSummary,
      },
      publishedMarksSummary: {
        totalAssessmentsPublished: publishedMarksSummary.length,
        assessments: publishedMarksSummary,
      },
      recentAcademicUpdates,
      attendance: {
        overallPercentage: overallAttendancePercentage,
        totalClasses: totalSessions,
        attendedClasses: attendedSessions,
        absentClasses: absentSessions,
        subjectSummary: subjectAttendanceSummary,
      },
      marks: {
        publishedCount: publishedMarksSummary.length,
        publishedMarks: publishedMarksSummary,
        publicationStatuses: assessmentPublicationStatus,
      },
      isAdmissionApplicant: false,
      admissionStatus: 'ENROLLED',
      admissionDashboardUrl: '/admission/dashboard',
    };
  }

  /**
   * Attendance Page: Dynamic, real-time subject-wise breakdown & stats
   * STRICTLY returns ONLY data that has been explicitly released by the authorized HOD.
   */
  async getStudentAttendanceSummary(userId: string): Promise<any> {
    const { student, isAdmissionApplicant } = await this.resolveStudentContext(userId);

    if (isAdmissionApplicant || !student) {
      return {
        overallPercentage: 0,
        totalClasses: 0,
        attendedClasses: 0,
        absentClasses: 0,
        excusedClasses: 0,
        overall: {
          percentage: 0,
          totalClasses: 0,
          attendedClasses: 0,
          absentClasses: 0,
        },
        subjects: [],
        semesters: [],
        isAdmissionApplicant: true,
        statusNotice: 'Admission application in progress. Academic attendance tracking begins upon formal semester enrollment.',
      };
    }

    // Query explicitly released attendance for this student from the consolidated register releases
    const releasedAttendance = await StudentReleasedAcademicData.findAll({
      where: {
        studentId: student.id,
        releaseType: 'ATTENDANCE',
      },
      include: [
        {
          model: Subject,
          as: 'subject',
          attributes: ['id', 'name', 'code', 'credits', 'semester'],
        },
      ],
      order: [
        ['semester', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    });

    let totalClasses = 0;
    let attendedClasses = 0;
    let absentClasses = 0;
    let overallPercentage = 0;

    const subjects = releasedAttendance.map((rec) => {
      const s = rec.subject as any;
      const conducted = rec.conductedClasses || 0;
      const attended = rec.attendedClasses || 0;
      const absent = Math.max(0, conducted - attended);
      const pct = rec.attendancePercentage !== null ? Number(rec.attendancePercentage) : 0;

      totalClasses += conducted;
      attendedClasses += attended;
      absentClasses += absent;

      return {
        subjectId: rec.subjectId,
        subjectCode: s?.code || 'N/A',
        subjectName: s?.name || 'N/A',
        credits: s?.credits || 0,
        semester: rec.semester,
        academicYear: rec.academicYear,
        totalEligibleClasses: conducted,
        conductedClasses: conducted,
        attendedClasses: attended,
        absentClasses: absent,
        totalSessions: conducted,
        attendedSessions: attended,
        absentSessions: absent,
        percentage: pct,
        status: pct >= 85 ? ('Eligible' as const) : ('Shortage' as const),
        releaseStatus: 'RELEASED',
        releasedAt: (rec as any).createdAt,
      };
    });

    if (totalClasses > 0) {
      overallPercentage = Number(((attendedClasses / totalClasses) * 100).toFixed(1));
    }

    // Group subjects by semester
    const semesterMap: Record<number, any> = {};
    for (const sub of subjects) {
      if (!semesterMap[sub.semester]) {
        semesterMap[sub.semester] = {
          semester: sub.semester,
          academicYear: sub.academicYear,
          subjects: [],
          totalClasses: 0,
          attendedClasses: 0,
        };
      }
      semesterMap[sub.semester].subjects.push(sub);
      semesterMap[sub.semester].totalClasses += sub.totalEligibleClasses;
      semesterMap[sub.semester].attendedClasses += sub.attendedClasses;
    }

    const semesters = Object.values(semesterMap).map((grp: any) => ({
      semester: grp.semester,
      academicYear: grp.academicYear,
      totalClasses: grp.totalClasses,
      attendedClasses: grp.attendedClasses,
      overallPercentage: grp.totalClasses > 0 ? Number(((grp.attendedClasses / grp.totalClasses) * 100).toFixed(1)) : 0,
      subjects: grp.subjects,
    }));

    return {
      overallPercentage,
      totalClasses,
      attendedClasses,
      absentClasses,
      excusedClasses: 0,
      overall: {
        percentage: overallPercentage,
        totalClasses,
        attendedClasses,
        absentClasses,
      },
      subjects,
      semesters,
      isAdmissionApplicant: false,
      statusNotice:
        subjects.length === 0
          ? 'Attendance has not yet been released by the HOD for your semester. Officially released attendance will appear here once published.'
          : undefined,
    };
  }

  /**
   * Attendance History: Filterable date-wise attendance session records
   * Enforces that session history is only visible for subjects whose attendance has been officially released.
   */
  async getStudentAttendanceHistory(
    userId: string,
    filters: { subjectId?: string; startDate?: string; endDate?: string } = {}
  ): Promise<any> {
    const { student, isAdmissionApplicant } = await this.resolveStudentContext(userId);

    if (isAdmissionApplicant || !student) {
      return {
        history: [],
        totalCount: 0,
        totalRecords: 0,
        isAdmissionApplicant: true,
        statusNotice: 'No attendance sessions recorded. Attendance tracking begins once semester commences.',
      };
    }

    // Enforce that session history is only visible for subjects whose attendance has been officially released by HOD
    const releasedSubjectIds = (
      await StudentReleasedAcademicData.findAll({
        where: { studentId: student.id, releaseType: 'ATTENDANCE' },
        attributes: ['subjectId'],
      })
    ).map((r) => r.subjectId);

    if (releasedSubjectIds.length === 0) {
      return {
        history: [],
        totalCount: 0,
        totalRecords: 0,
        isAdmissionApplicant: false,
        statusNotice: 'Attendance records have not been released by the HOD yet.',
      };
    }

    const whereClause: any = {
      studentId: student.id,
      subjectId: { [Op.in]: releasedSubjectIds },
    };

    if (filters && filters.subjectId && filters.subjectId !== 'ALL') {
      if (releasedSubjectIds.includes(filters.subjectId)) {
        whereClause.subjectId = filters.subjectId;
      } else {
        return {
          history: [],
          totalCount: 0,
          totalRecords: 0,
          isAdmissionApplicant: false,
        };
      }
    }

    if (filters.startDate && filters.endDate) {
      whereClause.date = { [Op.between]: [filters.startDate, filters.endDate] };
    } else if (filters.startDate) {
      whereClause.date = { [Op.gte]: filters.startDate };
    } else if (filters.endDate) {
      whereClause.date = { [Op.lte]: filters.endDate };
    }

    const records = await AttendanceRecord.findAll({
      where: whereClause,
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }],
      order: [
        ['date', 'DESC'],
        ['sessionPeriod', 'DESC'],
      ],
      limit: 200,
    });

    const history = records.map((r) => ({
      id: r.id,
      date: r.date,
      sessionPeriod: r.sessionPeriod,
      subjectId: r.subjectId,
      subjectCode: (r as any).subject?.code || 'N/A',
      subjectName: (r as any).subject?.name || 'N/A',
      status: r.status,
    }));

    return {
      history,
      totalCount: history.length,
      totalRecords: history.length,
      isAdmissionApplicant: false,
    };
  }

  /**
   * Marks / CIE Results: STRICTLY returns ONLY published marks (isPublished = true / HOD release)
   * Exact Table Column Format:
   * | Subject Name | CIE-1 Marks | CIE-2 Marks | Assignment Marks | Final Internal Marks | External Marks | Status |
   */
  async getStudentPublishedMarks(userId: string, requestedSemester?: number): Promise<any> {
    const { student, admission, isAdmissionApplicant } = await this.resolveStudentContext(userId);

    if (isAdmissionApplicant || !student) {
      const sem = requestedSemester ? Number(requestedSemester) : (admission?.entrySemester || 1);
      return {
        semester: sem,
        academicYear: admission?.academicYear || '2026-27',
        semesters: [],
        subjects: [],
        marksBySubject: [],
        isAdmissionApplicant: true,
        statusNotice: 'Continuous Internal Evaluation marks will appear here once examinations are conducted and officially published.',
      };
    }

    // 1. Fetch only officially released marks from StudentReleasedAcademicData
    const marksWhere: any = {
      studentId: student.id,
      releaseType: 'MARKS',
    };
    if (requestedSemester) {
      marksWhere.semester = Number(requestedSemester);
    }

    const releasedMarks = await StudentReleasedAcademicData.findAll({
      where: marksWhere,
      include: [
        {
          model: Subject,
          as: 'subject',
          attributes: ['id', 'name', 'code', 'credits', 'semester'],
        },
      ],
      order: [
        ['semester', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    // 2. Identify all relevant semesters
    const activeSemesters = Array.from(
      new Set([
        ...(requestedSemester ? [Number(requestedSemester)] : [student.semester]),
        ...releasedMarks.map((r) => r.semester),
      ])
    ).sort((a, b) => a - b);

    // 3. Build semester-wise tables
    const semesterTables = await Promise.all(
      activeSemesters.map(async (sem) => {
        // Find academic subjects for this semester
        const releasedSubjectIdsForSem = releasedMarks
          .filter((r) => r.semester === sem)
          .map((r) => r.subjectId);

        const subjectWhere: any = {
          semester: sem,
        };

        if (sem === 1 || sem === 2) {
          // Applied Science handles semesters 1 & 2 across branches
        } else {
          subjectWhere[Op.or] = [
            { departmentId: student.departmentId },
            { departmentId: null },
            ...(releasedSubjectIdsForSem.length > 0 ? [{ id: { [Op.in]: releasedSubjectIdsForSem } }] : []),
          ];
        }

        const subjects = await Subject.findAll({
          where: subjectWhere,
          attributes: ['id', 'name', 'code', 'credits', 'semester'],
          order: [['code', 'ASC']],
        });

        const rows = subjects.map((subj) => {
          const subMarks = releasedMarks.filter(
            (r) => r.subjectId === subj.id && r.semester === sem
          );

          const cie1Rel = subMarks.find((r) => r.assessmentType === 'CIE1');
          const cie2Rel = subMarks.find((r) => r.assessmentType === 'CIE2');
          const assignmentRel = subMarks.find((r) => r.assessmentType === 'ASSIGNMENT');
          const finalInternalRel = subMarks.find((r) => r.assessmentType === 'FINAL_INTERNAL');
          const externalRel = subMarks.find((r) => r.assessmentType === 'EXTERNAL');

          const releasedAssessments = [cie1Rel, cie2Rel, assignmentRel, finalInternalRel, externalRel].filter(Boolean);
          const count = releasedAssessments.length;

          let status = 'NOT_RELEASED';
          let statusLabel = 'Not Released';
          if (count === 5) {
            status = 'FULLY_RELEASED';
            statusLabel = 'Fully Released';
          } else if (count > 0) {
            status = 'PARTIALLY_RELEASED';
            statusLabel = 'Partially Released';
          }

          // Exact column representations:
          // Unreleased columns remain strictly null / "Not Released"
          const cie1Display = cie1Rel ? `${cie1Rel.marksObtained !== null ? cie1Rel.marksObtained : 0} / ${cie1Rel.maxMarks || 50}` : 'Not Released';
          const cie2Display = cie2Rel ? `${cie2Rel.marksObtained !== null ? cie2Rel.marksObtained : 0} / ${cie2Rel.maxMarks || 50}` : 'Not Released';
          const assignmentDisplay = assignmentRel ? `${assignmentRel.marksObtained !== null ? assignmentRel.marksObtained : 0} / ${assignmentRel.maxMarks || 25}` : 'Not Released';
          const finalInternalDisplay = finalInternalRel ? `${finalInternalRel.marksObtained !== null ? finalInternalRel.marksObtained : 0} / ${finalInternalRel.maxMarks || 50}` : 'Not Released';
          const externalDisplay = externalRel ? `${externalRel.marksObtained !== null ? externalRel.marksObtained : 0} / ${externalRel.maxMarks || 100}` : 'Not Released';

          // Legacy assessment array for backwards compatibility
          const assessments: any[] = [];
          if (cie1Rel) {
            assessments.push({
              id: cie1Rel.id,
              assessmentName: 'CIE 1',
              assessmentType: 'CIE1',
              maximumMarks: Number(cie1Rel.maxMarks || 50),
              marksObtained: cie1Rel.marksObtained !== null ? Number(cie1Rel.marksObtained) : 0,
              percentage: Number(cie1Rel.percentage || 0),
              isPublished: true,
              publishedAt: cie1Rel.createdAt.toISOString(),
              status: 'RELEASED',
            });
          }
          if (cie2Rel) {
            assessments.push({
              id: cie2Rel.id,
              assessmentName: 'CIE 2',
              assessmentType: 'CIE2',
              maximumMarks: Number(cie2Rel.maxMarks || 50),
              marksObtained: cie2Rel.marksObtained !== null ? Number(cie2Rel.marksObtained) : 0,
              percentage: Number(cie2Rel.percentage || 0),
              isPublished: true,
              publishedAt: cie2Rel.createdAt.toISOString(),
              status: 'RELEASED',
            });
          }
          if (assignmentRel) {
            assessments.push({
              id: assignmentRel.id,
              assessmentName: 'Assignment',
              assessmentType: 'ASSIGNMENT',
              maximumMarks: Number(assignmentRel.maxMarks || 25),
              marksObtained: assignmentRel.marksObtained !== null ? Number(assignmentRel.marksObtained) : 0,
              percentage: Number(assignmentRel.percentage || 0),
              isPublished: true,
              publishedAt: assignmentRel.createdAt.toISOString(),
              status: 'RELEASED',
            });
          }
          if (finalInternalRel) {
            assessments.push({
              id: finalInternalRel.id,
              assessmentName: 'Final Internal Marks',
              assessmentType: 'FINAL_INTERNAL',
              maximumMarks: Number(finalInternalRel.maxMarks || 50),
              marksObtained: finalInternalRel.marksObtained !== null ? Number(finalInternalRel.marksObtained) : 0,
              percentage: Number(finalInternalRel.percentage || 0),
              isPublished: true,
              publishedAt: finalInternalRel.createdAt.toISOString(),
              status: 'RELEASED',
            });
          }
          if (externalRel) {
            assessments.push({
              id: externalRel.id,
              assessmentName: 'External Marks',
              assessmentType: 'EXTERNAL',
              maximumMarks: Number(externalRel.maxMarks || 100),
              marksObtained: externalRel.marksObtained !== null ? Number(externalRel.marksObtained) : 0,
              percentage: Number(externalRel.percentage || 0),
              isPublished: true,
              publishedAt: externalRel.createdAt.toISOString(),
              status: 'RELEASED',
            });
          }

          return {
            subjectId: subj.id,
            subjectCode: subj.code,
            subjectName: subj.name,
            credits: subj.credits,
            semester: sem,
            academicYear: student.currentAcademicYear || '2026-27',
            // Table-specific columns
            cie1Marks: cie1Rel ? (cie1Rel.marksObtained !== null ? Number(cie1Rel.marksObtained) : 0) : null,
            cie2Marks: cie2Rel ? (cie2Rel.marksObtained !== null ? Number(cie2Rel.marksObtained) : 0) : null,
            assignmentMarks: assignmentRel ? (assignmentRel.marksObtained !== null ? Number(assignmentRel.marksObtained) : 0) : null,
            finalInternalMarks: finalInternalRel ? (finalInternalRel.marksObtained !== null ? Number(finalInternalRel.marksObtained) : 0) : null,
            externalMarks: externalRel ? (externalRel.marksObtained !== null ? Number(externalRel.marksObtained) : 0) : null,
            // Display strings
            cie1Display,
            cie2Display,
            assignmentDisplay,
            finalInternalDisplay,
            externalDisplay,
            status,
            statusLabel,
            // Objects
            cie1: cie1Rel ? { marksObtained: Number(cie1Rel.marksObtained || 0), maximumMarks: Number(cie1Rel.maxMarks || 50) } : null,
            cie2: cie2Rel ? { marksObtained: Number(cie2Rel.marksObtained || 0), maximumMarks: Number(cie2Rel.maxMarks || 50) } : null,
            assessments,
            publicationStatus: count === 5 ? 'FULLY_PUBLISHED' : count > 0 ? 'PARTIALLY_PUBLISHED' : 'NOT_PUBLISHED',
          };
        });

        return {
          semester: sem,
          academicYear: student.currentAcademicYear || '2026-27',
          rows,
          subjects: rows,
        };
      })
    );

    const currentSemTable = semesterTables.find(
      (st) => st.semester === (requestedSemester ? Number(requestedSemester) : student.semester)
    ) || semesterTables[0];

    return {
      semester: requestedSemester ? Number(requestedSemester) : student.semester,
      academicYear: student.currentAcademicYear || '2026-27',
      semesters: semesterTables,
      subjects: currentSemTable?.rows || [],
      marksBySubject: currentSemTable?.rows || [],
      isAdmissionApplicant: false,
    };
  }

  /**
   * Profile Page: Read-only admission and student profile (Strictly NO document download/preview)
   */
  async getStudentProfile(userId: string): Promise<any> {
    const { user, student, admission } = await this.resolveStudentContext(userId);
    const u = student?.user || user || {};
    const d = student?.department || (admission as any)?.branch || {};
    const branch = (admission as any)?.branch || {};

    const pd = (admission as any)?.studentpersonaldetails || {};
    const prd = (admission as any)?.studentparentdetails || {};
    const addr = (admission as any)?.studentaddress || {};
    const acd = (admission as any)?.studentacademicdetails || {};

    const maskAadhaar = (aadhaarStr: string | null | undefined): string => {
      if (!aadhaarStr) return 'N/A';
      const clean = aadhaarStr.replace(/\s+/g, '');
      if (clean.length === 12) {
        return `XXXX-XXXX-${clean.slice(8)}`;
      }
      return clean.length > 4 ? `XXXX-${clean.slice(-4)}` : 'XXXX';
    };

    const fullName = `${pd.firstName || u.firstName || ''} ${pd.middleName || u.middleName || ''} ${pd.lastName || u.lastName || ''}`.replace(/\s+/g, ' ').trim() || u.username || 'Student';
    const deptName = d.name || branch.name || 'Branch Allocation Pending';
    const deptCode = d.code || branch.code || 'N/A';
    const currentSem = student?.semester || admission?.entrySemester || 1;
    const currentSection = (student as any)?.sectionEntity?.name || student?.section || 'Unassigned';
    const currentAy = student?.currentAcademicYear || admission?.academicYear || '2026-27';
    const currentUsn = student?.usn || admission?.cetNumber || admission?.applicationNumber || 'PENDING';

    return {
      student: {
        id: student?.id || user.id,
        name: fullName,
        usn: currentUsn,
        email: u.email || user.email || 'N/A',
        phone: u.phone || user.phone || 'N/A',
        gender: pd.gender || student?.gender || u.gender || 'N/A',
        dob: pd.dateOfBirth || student?.dateOfBirth ? (pd.dateOfBirth || student?.dateOfBirth).toString() : 'N/A',
        bloodGroup: pd.bloodGroup || 'N/A',
        category: pd.category || 'N/A',
        caste: pd.caste || 'N/A',
        religion: pd.religion || 'N/A',
        nationality: pd.nationality || 'Indian',
        aadhaarNumberMasked: maskAadhaar(admission?.aadhaar),
      },
      admission: admission ? {
        id: admission.id,
        applicationNumber: admission.applicationNumber || 'N/A',
        status: admission.applicationStatus || 'DRAFT',
        admissionType: admission.admissionType || student?.admissionType || 'KCET',
        quota: admission.admissionType || 'General',
        enrolledAt: admission.enrolledAt ? admission.enrolledAt.toISOString() : null,
        createdAt: admission.createdAt ? admission.createdAt.toISOString() : null,
      } : null,
      academic: {
        program: 'B.E. (Bachelor of Engineering)',
        departmentName: deptName,
        departmentCode: deptCode,
        currentSemester: currentSem,
        section: currentSection,
        academicYear: currentAy,
        previousSchool: student?.previousCollege || acd.twelfthSchool || acd.diplomaUniversity || acd.tenthSchool || 'N/A',
        previousBoard: acd.twelfthBoard || acd.tenthBoard || 'State Board',
        previousPercentage: acd.twelfthPercentage || acd.diplomaPercentage || acd.tenthPercentage || 'N/A',
        rank: acd.cetRank ? `#${acd.cetRank}` : admission?.cetNumber || 'N/A',
      },
      qualifications: {
        tenth: {
          school: acd.tenthSchool || 'N/A',
          board: acd.tenthBoard || 'State Board',
          passingYear: acd.tenthPassingYear || 'N/A',
          registerNumber: acd.tenthRegisterNumber || 'N/A',
          marksObtained: acd.tenthMarksObtained ?? null,
          maxMarks: acd.tenthMaxMarks ?? null,
          percentage: acd.tenthPercentage ? `${acd.tenthPercentage}%` : 'N/A',
          attempts: acd.tenthAttempts || 1,
        },
        twelfth: acd.twelfthSchool ? {
          school: acd.twelfthSchool,
          board: acd.twelfthBoard || 'Karnataka Pre-University Board',
          passingYear: acd.twelfthPassingYear || 'N/A',
          registerNumber: acd.twelfthRegisterNumber || 'N/A',
          stream: acd.twelfthStream || 'Science',
          percentage: acd.twelfthPercentage ? `${acd.twelfthPercentage}%` : 'N/A',
          physicsMarks: acd.physicsMarks ?? null,
          mathsMarks: acd.mathsMarks ?? null,
          chemistryMarks: acd.chemistryMarks ?? null,
        } : null,
        diploma: acd.diplomaUniversity ? {
          university: acd.diplomaUniversity,
          year: acd.diplomaYear || 'N/A',
          registerNumber: acd.diplomaRegisterNumber || 'N/A',
          percentage: acd.diplomaPercentage ? `${acd.diplomaPercentage}%` : 'N/A',
        } : null,
        entranceExam: {
          cetNumber: admission?.cetNumber || (student as any)?.cetNumber || 'N/A',
          dcetNumber: admission?.dcetNumber || (student as any)?.dcetNumber || null,
          cetScore: acd.cetScore ?? null,
          cetRank: acd.cetRank ? `#${acd.cetRank}` : null,
        },
      },
      contact: {
        studentMobile: u.phone || user.phone || 'N/A',
        studentEmail: u.email || user.email || 'N/A',
        emergencyContact: student?.parentPhone || prd.fatherPhone || prd.motherPhone || user.phone || 'N/A',
      },
      address: {
        permanent: {
          line1: addr.permanentAddressLine1 || student?.address || 'N/A',
          line2: addr.permanentAddressLine2 || '',
          city: addr.permanentCity || 'N/A',
          district: addr.permanentDistrict || 'N/A',
          state: addr.permanentState || 'Karnataka',
          pincode: addr.permanentPincode || 'N/A',
        },
        correspondence: {
          line1: addr.communicationAddressLine1 || addr.permanentAddressLine1 || student?.address || 'N/A',
          line2: addr.communicationAddressLine2 || '',
          city: addr.communicationCity || addr.permanentCity || 'N/A',
          district: addr.communicationDistrict || addr.permanentDistrict || 'N/A',
          state: addr.communicationState || addr.permanentState || 'Karnataka',
          pincode: addr.communicationPincode || addr.permanentPincode || 'N/A',
        },
      },
      parent: {
        fatherName: student?.fatherName || prd.fatherName || 'N/A',
        fatherOccupation: prd.fatherOccupation || 'N/A',
        fatherPhone: prd.fatherPhone || student?.parentPhone || 'N/A',
        fatherEmail: prd.fatherEmail || 'N/A',
        motherName: student?.motherName || prd.motherName || 'N/A',
        motherOccupation: prd.motherOccupation || 'N/A',
        motherPhone: prd.motherPhone || 'N/A',
        motherEmail: prd.motherEmail || 'N/A',
        guardianName: prd.guardianName || 'N/A',
        guardianPhone: prd.guardianPhone || 'N/A',
        annualIncome: (prd.fatherAnnualIncome || prd.annualIncome) ? `₹${Number(prd.fatherAnnualIncome || prd.annualIncome).toLocaleString('en-IN')}` : 'N/A',
      },
      // Backwards compatibility mappings for older components:
      personal: {
        firstName: pd.firstName || u.firstName || 'N/A',
        middleName: pd.middleName || u.middleName || null,
        lastName: pd.lastName || u.lastName || 'N/A',
        fullName,
        dateOfBirth: pd.dateOfBirth || student?.dateOfBirth || 'N/A',
        gender: pd.gender || student?.gender || u.gender || 'N/A',
        caste: pd.caste || 'N/A',
        category: pd.category || 'N/A',
        religion: pd.religion || 'N/A',
        nationality: pd.nationality || 'Indian',
        studiedInKarnataka: pd.studiedInKarnataka !== null && pd.studiedInKarnataka !== undefined ? Boolean(pd.studiedInKarnataka) : null,
        areaType: pd.areaType || 'N/A',
        aadhaarMasked: maskAadhaar(admission?.aadhaar),
        profileImage: u.profileImage || null,
      },
      parentGuardian: {
        fatherName: student?.fatherName || prd.fatherName || 'N/A',
        fatherPhone: prd.fatherPhone || student?.parentPhone || 'N/A',
        fatherEmail: prd.fatherEmail || 'N/A',
        fatherOccupation: prd.fatherOccupation || 'N/A',
        motherName: student?.motherName || prd.motherName || 'N/A',
        motherPhone: prd.motherPhone || 'N/A',
        motherEmail: prd.motherEmail || 'N/A',
        motherOccupation: prd.motherOccupation || 'N/A',
        guardianName: prd.guardianName || null,
        guardianPhone: prd.guardianPhone || null,
        annualIncome: (prd.fatherAnnualIncome || prd.annualIncome) ? `₹${Number(prd.fatherAnnualIncome || prd.annualIncome).toLocaleString('en-IN')}` : 'N/A',
      },
      academicAndAdmission: {
        usn: currentUsn,
        enrollmentNumber: student?.enrollmentNumber || admission?.applicationNumber || 'N/A',
        rollNumber: student?.rollNumber || 'N/A',
        applicationNumber: admission?.applicationNumber || 'N/A',
        department: deptName,
        departmentCode: deptCode,
        program: 'B.E. (Bachelor of Engineering)',
        currentSemester: currentSem,
        section: currentSection,
        batch: student?.batch || admission?.academicYear || '2026-27',
        batchYear: student?.batchYear || 2026,
        admissionBatch: student?.admissionBatch,
        academicYear: currentAy,
        admissionType: admission?.admissionType || student?.admissionType || 'KCET',
        applicationType: admission?.applicationType || 'FRESH',
        entrySemester: admission?.entrySemester || student?.initialSemester || 1,
        cetNumber: admission?.cetNumber || 'N/A',
        dcetNumber: admission?.dcetNumber || null,
        previousCollege: student?.previousCollege || acd.pucCollegeName || acd.diplomaCollegeName || 'N/A',
        qualifyingExam: acd.qualifyingExam || admission?.qualification || 'PUC',
        pucRegisterNumber: acd.pucRegisterNumber || 'N/A',
        pucBoard: acd.pucBoard || 'Karnataka Pre-University Board',
        pucMarksPercentage: acd.pucPercentage ? `${acd.pucPercentage}%` : 'N/A',
        tenthSchoolName: acd.tenthSchoolName || 'N/A',
        tenthBoard: acd.tenthBoard || 'KSEEB',
        tenthMarksPercentage: acd.tenthPercentage ? `${acd.tenthPercentage}%` : 'N/A',
      },
    };
  }
}

export default new StudentDashboardService();
