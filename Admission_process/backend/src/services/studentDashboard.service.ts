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

    // 1. Calculate overall attendance directly from AttendanceRecord
    const allAttendance = await AttendanceRecord.findAll({
      where: { studentId: s.id },
      attributes: ['status', 'subjectId'],
    });

    const totalSessions = allAttendance.length;
    const attendedSessions = allAttendance.filter((r) => r.status === 'PRESENT' || r.status === 'EXCUSED').length;
    const absentSessions = allAttendance.filter((r) => r.status === 'ABSENT').length;
    const overallAttendancePercentage = totalSessions > 0
      ? Number(((attendedSessions / totalSessions) * 100).toFixed(1))
      : 0;

    // 2. Calculate subject-wise attendance breakdown
    const subjectAttendanceMap: Record<string, { total: number; attended: number; absent: number }> = {};
    for (const rec of allAttendance) {
      if (!subjectAttendanceMap[rec.subjectId]) {
        subjectAttendanceMap[rec.subjectId] = { total: 0, attended: 0, absent: 0 };
      }
      subjectAttendanceMap[rec.subjectId].total += 1;
      if (rec.status === 'PRESENT' || rec.status === 'EXCUSED') {
        subjectAttendanceMap[rec.subjectId].attended += 1;
      } else if (rec.status === 'ABSENT') {
        subjectAttendanceMap[rec.subjectId].absent += 1;
      }
    }

    // Fetch subjects for current semester
    const subjects = await Subject.findAll({
      where: {
        semester: s.semester,
        [Op.or]: [
          { departmentId: s.departmentId },
          { departmentId: null },
        ],
      },
      attributes: ['id', 'name', 'code', 'credits'],
      order: [['code', 'ASC']],
    });

    const subjectAttendanceSummary = subjects.map((subj) => {
      const stats = subjectAttendanceMap[subj.id] || { total: 0, attended: 0, absent: 0 };
      const percentage = stats.total > 0
        ? Number(((stats.attended / stats.total) * 100).toFixed(1))
        : 0;

      return {
        subjectId: subj.id,
        subjectCode: subj.code,
        subjectName: subj.name,
        totalClasses: stats.total,
        attendedClasses: stats.attended,
        absentClasses: stats.absent,
        totalSessions: stats.total,
        attendedSessions: stats.attended,
        absentSessions: stats.absent,
        percentage,
        status: percentage >= 75 ? ('Eligible' as const) : ('Shortage' as const),
      };
    });

    // 3. Fetch published marks summary (ONLY isPublished = true)
    const publishedConfigs = await AssessmentConfiguration.findAll({
      where: {
        semester: s.semester,
        academicYear: s.currentAcademicYear || '2026-27',
        isPublished: true,
      },
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }],
    });

    const publishedConfigIds = publishedConfigs.map((c) => c.id);
    const studentSummaries = publishedConfigIds.length > 0
      ? await StudentAssessmentSummary.findAll({
          where: {
            assessmentConfigurationId: { [Op.in]: publishedConfigIds },
            studentId: s.id,
          },
        })
      : [];

    const summaryMap: Record<string, StudentAssessmentSummary> = {};
    for (const sum of studentSummaries) {
      summaryMap[sum.assessmentConfigurationId] = sum;
    }

    const publishedMarksSummary = publishedConfigs.map((c) => {
      const sum = summaryMap[c.id];
      return {
        id: c.id,
        assessmentId: c.id,
        assessmentName: c.assessmentType,
        assessmentType: c.assessmentType,
        subjectCode: c.subject?.code,
        subjectName: c.subject?.name,
        semester: s.semester,
        maximumMarks: Number(c.maximumMarks),
        marksObtained: sum ? Number(sum.finalCieMarks) : 0,
        percentage: sum ? Number(sum.percentage) : 0,
        publishedAt: c.publishedAt ? c.publishedAt.toISOString() : new Date().toISOString(),
      };
    });

    // 4. Assessment publication status summary (safe statuses)
    const allSemesterConfigs = await AssessmentConfiguration.findAll({
      where: {
        semester: s.semester,
        academicYear: s.currentAcademicYear || '2026-27',
      },
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }],
    });

    const assessmentPublicationStatus = allSemesterConfigs.map((c) => ({
      assessmentType: c.assessmentType,
      subjectCode: c.subject?.code,
      subjectName: c.subject?.name,
      isPublished: Boolean(c.isPublished),
      statusLabel: c.isPublished ? 'Published' : 'Evaluation in Progress',
      publishedAt: c.publishedAt,
    }));

    // 5. Recent academic updates timeline
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
        isAdmissionApplicant: true,
        statusNotice: 'Admission application in progress. Academic attendance tracking begins upon formal semester enrollment.',
      };
    }

    const allRecords = await AttendanceRecord.findAll({
      where: { studentId: student.id },
      attributes: ['id', 'subjectId', 'status', 'date', 'sessionPeriod'],
    });

    const totalSessions = allRecords.length;
    const attendedSessions = allRecords.filter((r) => r.status === 'PRESENT' || r.status === 'EXCUSED').length;
    const absentSessions = allRecords.filter((r) => r.status === 'ABSENT').length;
    const overallPercentage = totalSessions > 0
      ? Number(((attendedSessions / totalSessions) * 100).toFixed(1))
      : 0;

    const subjects = await Subject.findAll({
      where: {
        semester: student.semester,
        [Op.or]: [
          { departmentId: student.departmentId },
          { departmentId: null },
        ],
      },
      attributes: ['id', 'name', 'code', 'credits'],
      order: [['code', 'ASC']],
    });

    const subjectMap: Record<string, { total: number; attended: number; absent: number }> = {};
    for (const rec of allRecords) {
      if (!subjectMap[rec.subjectId]) {
        subjectMap[rec.subjectId] = { total: 0, attended: 0, absent: 0 };
      }
      subjectMap[rec.subjectId].total += 1;
      if (rec.status === 'PRESENT' || rec.status === 'EXCUSED') {
        subjectMap[rec.subjectId].attended += 1;
      } else if (rec.status === 'ABSENT') {
        subjectMap[rec.subjectId].absent += 1;
      }
    }

    const subjectBreakdown = subjects.map((s) => {
      const stats = subjectMap[s.id] || { total: 0, attended: 0, absent: 0 };
      const pct = stats.total > 0 ? Number(((stats.attended / stats.total) * 100).toFixed(1)) : 0;
      return {
        subjectId: s.id,
        subjectCode: s.code,
        subjectName: s.name,
        credits: s.credits,
        totalEligibleClasses: stats.total,
        attendedClasses: stats.attended,
        absentClasses: stats.absent,
        totalSessions: stats.total,
        attendedSessions: stats.attended,
        absentSessions: stats.absent,
        percentage: pct,
        status: pct >= 75 ? ('Eligible' as const) : ('Shortage' as const),
      };
    });

    return {
      overallPercentage,
      totalClasses: totalSessions,
      attendedClasses: attendedSessions,
      absentClasses: absentSessions,
      excusedClasses: 0,
      overall: {
        percentage: overallPercentage,
        totalClasses: totalSessions,
        attendedClasses: attendedSessions,
        absentClasses: absentSessions,
      },
      subjects: subjectBreakdown,
      isAdmissionApplicant: false,
    };
  }

  /**
   * Attendance History: Filterable date-wise attendance session records
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

    const whereClause: any = { studentId: student.id };

    if (filters && filters.subjectId && filters.subjectId !== 'ALL') {
      whereClause.subjectId = filters.subjectId;
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
   * Marks / CIE Results: STRICTLY returns ONLY published marks (isPublished = true)
   */
  async getStudentPublishedMarks(userId: string, requestedSemester?: number): Promise<any> {
    const { student, admission, isAdmissionApplicant } = await this.resolveStudentContext(userId);

    if (isAdmissionApplicant || !student) {
      const sem = requestedSemester ? Number(requestedSemester) : (admission?.entrySemester || 1);
      return {
        semester: sem,
        academicYear: admission?.academicYear || '2026-27',
        subjects: [],
        marksBySubject: [],
        isAdmissionApplicant: true,
        statusNotice: 'Continuous Internal Evaluation marks will appear here once examinations are conducted and officially published.',
      };
    }

    const semester = requestedSemester ? Number(requestedSemester) : student.semester;

    // Fetch all academic subjects for this semester
    const subjects = await Subject.findAll({
      where: {
        semester,
        [Op.or]: [
          { departmentId: student.departmentId },
          { departmentId: null },
        ],
      },
      attributes: ['id', 'name', 'code', 'credits'],
      order: [['code', 'ASC']],
    });

    // Fetch published assessments for this semester
    const publishedConfigs = await AssessmentConfiguration.findAll({
      where: {
        semester,
        isPublished: true,
      },
      attributes: ['id', 'subjectId', 'assessmentType', 'maximumMarks', 'publishedAt', 'status', 'isPublished'],
    });

    const publishedConfigIds = publishedConfigs.map((c) => c.id);
    const summaries = publishedConfigIds.length > 0
      ? await StudentAssessmentSummary.findAll({
          where: {
            assessmentConfigurationId: { [Op.in]: publishedConfigIds },
            studentId: student.id,
          },
        })
      : [];

    const summaryMap: Record<string, StudentAssessmentSummary> = {};
    for (const s of summaries) {
      summaryMap[s.assessmentConfigurationId] = s;
    }

    // Map by subject ID
    const subjectMarksList = subjects.map((subj) => {
      const cie1Config = publishedConfigs.find(
        (c) => c.subjectId === subj.id && c.assessmentType === 'CIE1'
      );
      const cie2Config = publishedConfigs.find(
        (c) => c.subjectId === subj.id && c.assessmentType === 'CIE2'
      );

      const cie1Summary = cie1Config ? summaryMap[cie1Config.id] : null;
      const cie2Summary = cie2Config ? summaryMap[cie2Config.id] : null;

      const cie1Data = cie1Config && cie1Summary
        ? {
            marksObtained: Number(cie1Summary.finalCieMarks),
            maximumMarks: Number(cie1Config.maximumMarks),
            percentage: Number(cie1Summary.percentage),
            publishedAt: cie1Config.publishedAt,
            status: 'PUBLISHED',
          }
        : cie1Config
        ? {
            marksObtained: 0,
            maximumMarks: Number(cie1Config.maximumMarks),
            percentage: 0,
            publishedAt: cie1Config.publishedAt,
            status: 'PUBLISHED',
          }
        : null;

      const cie2Data = cie2Config && cie2Summary
        ? {
            marksObtained: Number(cie2Summary.finalCieMarks),
            maximumMarks: Number(cie2Config.maximumMarks),
            percentage: Number(cie2Summary.percentage),
            publishedAt: cie2Config.publishedAt,
            status: 'PUBLISHED',
          }
        : cie2Config
        ? {
            marksObtained: 0,
            maximumMarks: Number(cie2Config.maximumMarks),
            percentage: 0,
            publishedAt: cie2Config.publishedAt,
            status: 'PUBLISHED',
          }
        : null;

      const isFullyPublished = Boolean(cie1Data && cie2Data);
      const isPartiallyPublished = Boolean(cie1Data || cie2Data);

      // Detailed assessment items for StudentMarksPage
      const assessments: Array<{
        id: string;
        assessmentName: string;
        assessmentType: string;
        maximumMarks: number;
        marksObtained: number | null;
        percentage: number | null;
        isPublished: boolean;
        publishedAt: string | null;
        status: string;
      }> = [];

      if (cie1Config && cie1Config.isPublished) {
        assessments.push({
          id: cie1Config.id,
          assessmentName: 'CIE 1',
          assessmentType: 'CIE1',
          maximumMarks: Number(cie1Config.maximumMarks),
          marksObtained: cie1Summary ? Number(cie1Summary.finalCieMarks) : null,
          percentage: cie1Summary ? Number(cie1Summary.percentage) : null,
          isPublished: true,
          publishedAt: cie1Config.publishedAt ? cie1Config.publishedAt.toISOString() : null,
          status: 'PUBLISHED',
        });
      }

      if (cie2Config && cie2Config.isPublished) {
        assessments.push({
          id: cie2Config.id,
          assessmentName: 'CIE 2',
          assessmentType: 'CIE2',
          maximumMarks: Number(cie2Config.maximumMarks),
          marksObtained: cie2Summary ? Number(cie2Summary.finalCieMarks) : null,
          percentage: cie2Summary ? Number(cie2Summary.percentage) : null,
          isPublished: true,
          publishedAt: cie2Config.publishedAt ? cie2Config.publishedAt.toISOString() : null,
          status: 'PUBLISHED',
        });
      }

      return {
        subjectId: subj.id,
        subjectCode: subj.code,
        subjectName: subj.name,
        semester,
        academicYear: student.currentAcademicYear || '2026-27',
        credits: subj.credits,
        cie1: cie1Data,
        cie2: cie2Data,
        assessments,
        publicationStatus: isFullyPublished
          ? 'FULLY_PUBLISHED'
          : isPartiallyPublished
          ? 'PARTIALLY_PUBLISHED'
          : 'NOT_PUBLISHED',
        statusNotice: isFullyPublished
          ? 'All CIE Results Published'
          : isPartiallyPublished
          ? 'Partial Results Published'
          : 'Results Not Yet Published',
      };
    });

    return {
      semester,
      academicYear: student.currentAcademicYear || '2026-27',
      subjects: subjectMarksList,
      marksBySubject: subjectMarksList,
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
        previousSchool: student?.previousCollege || acd.pucCollegeName || acd.diplomaCollegeName || acd.tenthSchoolName || 'N/A',
        previousBoard: acd.pucBoard || acd.tenthBoard || 'State Board',
        previousPercentage: acd.pucPercentage || acd.tenthPercentage || 'N/A',
        rank: admission?.cetNumber || 'N/A',
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
        annualIncome: prd.annualIncome ? `₹${Number(prd.annualIncome).toLocaleString('en-IN')}` : 'N/A',
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
        annualIncome: prd.annualIncome ? `₹${Number(prd.annualIncome).toLocaleString('en-IN')}` : 'N/A',
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
