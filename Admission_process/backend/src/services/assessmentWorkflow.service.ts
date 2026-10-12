import { Op } from 'sequelize';
import db from '../config/database';
import AssessmentConfiguration from '../models/AssessmentConfiguration';
import AssessmentReviewHistory from '../models/AssessmentReviewHistory';
import StudentAssessmentSummary from '../models/StudentAssessmentSummary';
import StudentQuestionMarks from '../models/StudentQuestionMarks';
import Subject from '../models/Subject';
import Department from '../models/Department';
import HOD from '../models/HOD';
import User from '../models/User';
import Student from '../models/Student';
import FacultyAssignment from '../models/FacultyAssignment';
import logger from '../utils/logger.util';

export interface AssessmentFilterQuery {
  academicYear?: string;
  semester?: number;
  departmentId?: string;
  subjectId?: string;
  assessmentType?: string;
  status?: string;
  search?: string;
}

class AssessmentWorkflowService {
  /**
   * Authoritative HOD Routing Resolver:
   * Semesters 1 and 2:
   *   Route assessment submissions to the configured Applied Science / Semester-Handling HOD.
   * Semesters 3 through 8:
   *   Route assessment submissions to the HOD of the subject's respective academic department.
   */
  async resolveAuthorizedHod(
    semester: number,
    subjectId: string,
    departmentId?: string
  ): Promise<{ hod: HOD; department: Department; isSemesterHandling: boolean }> {
    const sem = Number(semester);

    // ── 1. Semesters 1 & 2: Applied Science / Semester-Handling HOD ───────────
    if (sem === 1 || sem === 2) {
      const asDept = await Department.findOne({
        where: {
          [Op.or]: [
            { type: 'SEMESTER_HANDLING' },
            { code: 'AS' },
            { name: { [Op.iLike]: '%Applied Science%' } },
          ],
        },
      });

      if (!asDept) {
        throw new Error(
          'Applied Science department configuration not found. Please ensure Applied Science is registered.'
        );
      }

      // Find active HOD assigned to Applied Science
      let hod = await HOD.findOne({
        where: { departmentId: asDept.id, isActive: true },
        include: [{ model: User, as: 'user' }],
      });

      if (!hod) {
        // Fallback to most recent HOD assignment for Applied Science
        hod = await HOD.findOne({
          where: { departmentId: asDept.id },
          include: [{ model: User, as: 'user' }],
          order: [['updatedAt', 'DESC']],
        });
      }

      if (!hod) {
        throw new Error(
          'No Head of Department (HOD) is assigned to Applied Science (First-Year Coordinator). Please assign an HOD in Administration.'
        );
      }

      return { hod, department: asDept, isSemesterHandling: true };
    }

    // ── 2. Semesters 3 to 8: Departmental HOD ─────────────────────────────────
    let targetDeptId = departmentId;
    if (!targetDeptId && subjectId) {
      const subj = await Subject.findByPk(subjectId);
      targetDeptId = subj?.departmentId || undefined;
    }

    if (!targetDeptId) {
      throw new Error(
        `Unable to determine academic department for subject ${subjectId} in Semester ${sem}.`
      );
    }

    const dept = await Department.findByPk(targetDeptId);
    if (!dept) {
      throw new Error(`Academic department with ID '${targetDeptId}' does not exist.`);
    }

    let hod = await HOD.findOne({
      where: { departmentId: targetDeptId, isActive: true },
      include: [{ model: User, as: 'user' }],
    });

    if (!hod) {
      hod = await HOD.findOne({
        where: { departmentId: targetDeptId },
        include: [{ model: User, as: 'user' }],
        order: [['updatedAt', 'DESC']],
      });
    }

    if (!hod) {
      throw new Error(
        `No active Head of Department (HOD) is currently configured for department "${dept.name}" (${dept.code}). Please contact administration.`
      );
    }

    return { hod, department: dept, isSemesterHandling: false };
  }

  /**
   * Validates whether an authenticated HOD user is authorized to review/approve an assessment
   */
  async validateHodAuthorization(
    hodUserId: string,
    assessment: AssessmentConfiguration
  ): Promise<{ authorized: boolean; reason?: string; hod?: HOD; department?: Department }> {
    // Check if user is active HOD
    let hod = await HOD.findOne({
      where: { userId: hodUserId, isActive: true },
      include: [{ model: Department, as: 'department' }],
    });

    if (!hod || !(hod as any).department) {
      hod = await HOD.findOne({
        where: { userId: hodUserId },
        include: [{ model: Department, as: 'department' }],
        order: [['updatedAt', 'DESC']],
      });
    }

    if (!hod || !(hod as any).department) {
      return { authorized: false, reason: 'You are not assigned as an active Head of Department.' };
    }

    const dept = (hod as any).department as Department;
    const isSemHandling =
      dept.type === 'SEMESTER_HANDLING' ||
      dept.code === 'AS' ||
      /applied science/i.test(dept.name);

    const sem = Number(assessment.semester);

    // Semesters 1 and 2: exclusively Applied Science HOD
    if (sem === 1 || sem === 2) {
      if (isSemHandling) {
        return { authorized: true, hod, department: dept };
      }
      return {
        authorized: false,
        reason: `Submissions for Semester ${sem} are handled exclusively by the Applied Science HOD.`,
      };
    }

    // Semesters 3 to 8: Departmental HOD
    if (sem >= 3 && sem <= 8) {
      if (isSemHandling) {
        return {
          authorized: false,
          reason: 'Applied Science HOD scope is restricted to Semesters 1 and 2.',
        };
      }

      // Check department matching
      if (
        assessment.departmentId === dept.id ||
        assessment.subject?.departmentId === dept.id
      ) {
        return { authorized: true, hod, department: dept };
      }

      // Inspect subject department directly if needed
      if (assessment.subjectId) {
        const subj = await Subject.findByPk(assessment.subjectId);
        if (subj?.departmentId === dept.id) {
          return { authorized: true, hod, department: dept };
        }
      }

      return {
        authorized: false,
        reason: `This submission belongs to another academic department. You are only authorized to review submissions for ${dept.name} (${dept.code}).`,
      };
    }

    return { authorized: false, reason: 'Invalid semester scope.' };
  }

  /**
   * Faculty Action: Submit Assessment for HOD Review
   */
  async submitAssessment(
    facultyUserId: string,
    assessmentId: string
  ): Promise<{ success: boolean; message: string; assessment: AssessmentConfiguration }> {
    const assessment = await AssessmentConfiguration.findByPk(assessmentId, {
      include: [{ model: Subject, as: 'subject' }, { model: Department, as: 'department' }],
    });

    if (!assessment) {
      throw new Error('Assessment configuration not found.');
    }

    // Current state check
    if (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(assessment.status)) {
      throw new Error(
        `Assessment cannot be submitted because it is currently in "${assessment.status}" status.`
      );
    }

    // Verify faculty allocation permission
    const allocation = await FacultyAssignment.findOne({
      where: {
        userId: facultyUserId,
        subjectId: assessment.subjectId,
        semester: assessment.semester,
        academicYear: assessment.academicYear,
        status: 'ACTIVE',
      },
    });

    const user = await User.findByPk(facultyUserId);
    const isElevated = user && ['ADMIN', 'SUPER_ADMIN', 'DEAN', 'HOD'].includes(user.role);

    if (!allocation && !isElevated) {
      throw new Error('You are not assigned as the authorized faculty for this subject and semester.');
    }

    // Verify mark completeness
    const summariesCount = await StudentAssessmentSummary.count({
      where: { assessmentConfigurationId: assessment.id },
    });

    if (summariesCount === 0) {
      throw new Error('Cannot submit assessment without any entered student marks.');
    }

    // Resolve authoritative HOD via Semester Routing
    const { hod } = await this.resolveAuthorizedHod(
      assessment.semester,
      assessment.subjectId,
      assessment.departmentId
    );

    const fromStatus = assessment.status;
    const isResubmission = fromStatus === 'RETURNED';
    const toStatus = isResubmission ? 'RESUBMITTED' : 'SUBMITTED';

    const t = await db.transaction();
    try {
      assessment.status = toStatus;
      assessment.submittedAt = new Date();
      assessment.submittedBy = facultyUserId;
      assessment.assignedHodId = hod.userId;
      assessment.submissionCount = (assessment.submissionCount || 0) + 1;
      await assessment.save({ transaction: t });

      await AssessmentReviewHistory.create(
        {
          assessmentConfigurationId: assessment.id,
          action: toStatus,
          fromStatus,
          toStatus,
          actorId: facultyUserId,
          actorRole: user?.role || 'FACULTY',
          actorName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Faculty',
          comments: isResubmission
            ? 'Resubmitted marks after addressing HOD correction comments.'
            : 'Submitted assessment marks for HOD review.',
          metadata: {
            studentsCount: summariesCount,
            semester: assessment.semester,
            subjectCode: assessment.subject?.code,
            assignedHodUserId: hod.userId,
          },
        },
        { transaction: t }
      );

      await t.commit();

      logger.info(
        `EVENT: ASSESSMENT_${toStatus} | Config: ${assessment.id} | Subject: ${assessment.subject?.code} | Sem: ${assessment.semester} | HOD: ${hod.userId}`
      );

      return {
        success: true,
        message: isResubmission
          ? 'Assessment resubmitted successfully to HOD for review.'
          : 'Assessment submitted successfully to HOD for review.',
        assessment,
      };
    } catch (err: any) {
      await t.rollback();
      logger.error('SUBMIT_ASSESSMENT_TRANSACTION_ERROR:', err);
      throw err;
    }
  }

  /**
   * HOD Overview Statistics: Scoped strictly to HOD's authorized domain
   */
  async getHodAssessmentOverviewStats(hodUserId: string): Promise<{
    totalRequiringReview: number;
    pendingReview: number;
    returned: number;
    resubmitted: number;
    approved: number;
    published: number;
    totalAssessments: number;
  }> {
    let hod = await HOD.findOne({
      where: { userId: hodUserId, isActive: true },
      include: [{ model: Department, as: 'department' }],
    });

    if (!hod || !(hod as any).department) {
      hod = await HOD.findOne({
        where: { userId: hodUserId },
        include: [{ model: Department, as: 'department' }],
        order: [['updatedAt', 'DESC']],
      });
    }

    if (!hod || !(hod as any).department) {
      throw new Error('Authenticated user is not configured as an active HOD.');
    }

    const dept = (hod as any).department as Department;
    const isSemHandling =
      dept.type === 'SEMESTER_HANDLING' ||
      dept.code === 'AS' ||
      /applied science/i.test(dept.name);

    const baseWhere: any = {};

    if (isSemHandling) {
      baseWhere.semester = { [Op.in]: [1, 2] };
    } else {
      baseWhere.semester = { [Op.gte]: 3 };
      baseWhere.departmentId = dept.id;
    }

    const [
      pendingReview,
      resubmitted,
      returned,
      approved,
      published,
      totalAssessments,
    ] = await Promise.all([
      AssessmentConfiguration.count({ where: { ...baseWhere, status: 'SUBMITTED' } }),
      AssessmentConfiguration.count({ where: { ...baseWhere, status: 'RESUBMITTED' } }),
      AssessmentConfiguration.count({ where: { ...baseWhere, status: 'RETURNED' } }),
      AssessmentConfiguration.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      AssessmentConfiguration.count({
        where: {
          ...baseWhere,
          [Op.or]: [{ status: 'PUBLISHED' }, { isPublished: true }],
        },
      }),
      AssessmentConfiguration.count({ where: baseWhere }),
    ]);

    return {
      totalRequiringReview: pendingReview + resubmitted,
      pendingReview,
      returned,
      resubmitted,
      approved,
      published,
      totalAssessments,
    };
  }

  /**
   * HOD Submissions List: Returns submissions with filters respecting HOD's scope
   */
  async getHodAssessmentSubmissions(
    hodUserId: string,
    filters: AssessmentFilterQuery
  ): Promise<{
    submissions: any[];
    scope: { departmentName: string; departmentCode: string; isSemesterHandling: boolean };
  }> {
    let hod = await HOD.findOne({
      where: { userId: hodUserId, isActive: true },
      include: [{ model: Department, as: 'department' }],
    });

    if (!hod || !(hod as any).department) {
      hod = await HOD.findOne({
        where: { userId: hodUserId },
        include: [{ model: Department, as: 'department' }],
        order: [['updatedAt', 'DESC']],
      });
    }

    if (!hod || !(hod as any).department) {
      throw new Error('Authenticated user is not configured as an active HOD.');
    }

    const dept = (hod as any).department as Department;
    const isSemHandling =
      dept.type === 'SEMESTER_HANDLING' ||
      dept.code === 'AS' ||
      /applied science/i.test(dept.name);

    const whereClause: any = {};

    // 1. Mandatory Scope Enforcement
    if (isSemHandling) {
      whereClause.semester = { [Op.in]: [1, 2] };
    } else {
      whereClause.semester = { [Op.gte]: 3 };
      whereClause.departmentId = dept.id;
    }

    // 2. Client Filters within Scope
    if (filters.academicYear) {
      whereClause.academicYear = filters.academicYear;
    }
    if (filters.semester) {
      const s = Number(filters.semester);
      if (isSemHandling && (s === 1 || s === 2)) {
        whereClause.semester = s;
      } else if (!isSemHandling && s >= 3 && s <= 8) {
        whereClause.semester = s;
      }
    }
    if (filters.assessmentType) {
      whereClause.assessmentType = filters.assessmentType;
    }
    if (filters.status && filters.status !== 'ALL') {
      if (filters.status === 'REQUIRE_REVIEW') {
        whereClause.status = { [Op.in]: ['SUBMITTED', 'RESUBMITTED'] };
      } else {
        whereClause.status = filters.status;
      }
    }
    if (filters.subjectId) {
      whereClause.subjectId = filters.subjectId;
    }

    const configs = await AssessmentConfiguration.findAll({
      where: whereClause,
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
        { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'submitter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'reviewer', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [
        ['submittedAt', 'DESC NULLS LAST'],
        ['updatedAt', 'DESC'],
      ],
    });

    // Populate student counts and active faculty allocations
    const submissions = await Promise.all(
      configs.map(async (c) => {
        const studentCount = await StudentAssessmentSummary.count({
          where: { assessmentConfigurationId: c.id },
        });

        // Resolve allocated faculty from FacultyAssignment
        const allocation = await FacultyAssignment.findOne({
          where: {
            subjectId: c.subjectId,
            semester: c.semester,
            academicYear: c.academicYear,
            status: 'ACTIVE',
          },
          include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
        });

        const allocatedFaculty = (allocation as any)?.user || c.submitter || c.creator;

        return {
          id: c.id,
          assessmentType: c.assessmentType,
          academicYear: c.academicYear,
          semester: c.semester,
          departmentId: c.departmentId,
          departmentCode: c.department?.code,
          departmentName: c.department?.name,
          subjectId: c.subjectId,
          subjectCode: c.subject?.code,
          subjectName: c.subject?.name,
          maximumMarks: c.maximumMarks,
          status: c.status,
          isPublished: c.isPublished,
          submittedAt: c.submittedAt,
          submittedBy: c.submittedBy,
          allocatedFaculty: allocatedFaculty
            ? {
                id: allocatedFaculty.id,
                name: `${allocatedFaculty.firstName} ${allocatedFaculty.lastName || ''}`.trim(),
                email: allocatedFaculty.email,
              }
            : null,
          studentCount,
          hodReviewComment: c.hodReviewComment,
          reviewedAt: c.reviewedAt,
          approvedAt: c.approvedAt,
          publishedAt: c.publishedAt,
          submissionCount: c.submissionCount || 1,
        };
      })
    );

    return {
      submissions,
      scope: {
        departmentName: dept.name,
        departmentCode: dept.code,
        isSemesterHandling: isSemHandling,
      },
    };
  }

  /**
   * HOD Review Detail: Loads complete question-wise roster, totals, and review history
   */
  async getAssessmentReviewDetail(
    hodUserId: string,
    assessmentId: string
  ): Promise<any> {
    const assessment = await AssessmentConfiguration.findByPk(assessmentId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
        { model: User, as: 'creator' },
        { model: User, as: 'submitter' },
        { model: User, as: 'reviewer' },
        { model: User, as: 'approver' },
        { model: User, as: 'publisher' },
        {
          model: AssessmentReviewHistory,
          as: 'reviewHistory',
          include: [{ model: User, as: 'actor', attributes: ['id', 'firstName', 'lastName', 'role'] }],
          order: [['createdAt', 'ASC']],
        },
      ],
    });

    if (!assessment) {
      throw new Error('Assessment not found.');
    }

    const authCheck = await this.validateHodAuthorization(hodUserId, assessment);
    if (!authCheck.authorized) {
      throw new Error(authCheck.reason || 'You are not authorized to review this assessment.');
    }

    // Load student marks summaries
    const summaries = await StudentAssessmentSummary.findAll({
      where: { assessmentConfigurationId: assessment.id },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }],
        },
      ],
      order: [[{ model: Student, as: 'student' }, 'usn', 'ASC']],
    });

    // Load detailed subquestion marks
    const questionMarks = await StudentQuestionMarks.findAll({
      where: { assessmentConfigurationId: assessment.id },
    });

    const marksMap: Record<string, Record<string, number | null>> = {};
    for (const qm of questionMarks) {
      const studentId = qm.studentId;
      if (!marksMap[studentId]) marksMap[studentId] = {};
      marksMap[studentId][`${qm.questionId}___${qm.subquestionId}`] =
        qm.marksObtained !== null ? Number(qm.marksObtained) : null;
    }

    // Format student roster
    const studentRoster = summaries.map((s, idx) => {
      const st = s.student;
      const u = st?.user;
      const studentName = u ? `${u.firstName} ${u.lastName || ''}`.trim() : 'Unknown';

      return {
        slNo: idx + 1,
        studentId: s.studentId,
        usn: st?.usn || 'N/A',
        studentName,
        rawQuestionTotals: s.rawQuestionTotals || {},
        bestOfDetails: s.bestOfDetails || {},
        finalCieMarks: Number(s.finalCieMarks),
        percentage: Number(s.percentage),
        completionStatus: s.completionStatus,
        subquestionMarks: marksMap[s.studentId] || {},
      };
    });

    return {
      assessment: {
        id: assessment.id,
        assessmentType: assessment.assessmentType,
        academicYear: assessment.academicYear,
        semester: assessment.semester,
        departmentCode: assessment.department?.code,
        departmentName: assessment.department?.name,
        subjectCode: assessment.subject?.code,
        subjectName: assessment.subject?.name,
        maximumMarks: Number(assessment.maximumMarks),
        questionPattern: assessment.questionPattern,
        attemptRules: assessment.attemptRules,
        status: assessment.status,
        isPublished: assessment.isPublished,
        submittedAt: assessment.submittedAt,
        submittedBy: assessment.submitter
          ? `${assessment.submitter.firstName} ${assessment.submitter.lastName || ''}`.trim()
          : null,
        hodReviewComment: assessment.hodReviewComment,
        reviewedAt: assessment.reviewedAt,
        approvedAt: assessment.approvedAt,
        publishedAt: assessment.publishedAt,
        submissionCount: assessment.submissionCount,
      },
      students: studentRoster,
      reviewHistory: assessment.reviewHistory || [],
    };
  }

  /**
   * HOD Action: Approve & Publish Assessment
   * Enforces backend separation of approval and publication while supporting single-action execution.
   */
  async approveAndPublishAssessment(
    hodUserId: string,
    assessmentId: string,
    options: { publishNow?: boolean } = { publishNow: true }
  ): Promise<{ success: boolean; message: string; assessment: AssessmentConfiguration }> {
    const assessment = await AssessmentConfiguration.findByPk(assessmentId, {
      include: [{ model: Subject, as: 'subject' }, { model: Department, as: 'department' }],
    });

    if (!assessment) {
      throw new Error('Assessment not found.');
    }

    const authCheck = await this.validateHodAuthorization(hodUserId, assessment);
    if (!authCheck.authorized) {
      throw new Error(authCheck.reason || 'You are not authorized to approve this assessment.');
    }

    if (!['SUBMITTED', 'RESUBMITTED', 'APPROVED'].includes(assessment.status)) {
      throw new Error(
        `Assessment cannot be approved because it is in "${assessment.status}" status.`
      );
    }

    const summariesCount = await StudentAssessmentSummary.count({
      where: { assessmentConfigurationId: assessment.id },
    });

    if (summariesCount === 0) {
      throw new Error('Cannot approve an assessment with zero student marks.');
    }

    const hodUser = await User.findByPk(hodUserId);
    const hodName = hodUser ? `${hodUser.firstName} ${hodUser.lastName || ''}`.trim() : 'HOD';

    const t = await db.transaction();
    try {
      const fromStatus = assessment.status;
      const shouldPublish = options.publishNow !== false;

      // 1. Record Approval
      assessment.approvedAt = new Date();
      assessment.approvedBy = hodUserId;
      assessment.reviewedAt = new Date();
      assessment.reviewedBy = hodUserId;

      if (shouldPublish) {
        assessment.status = 'PUBLISHED';
        assessment.isPublished = true;
        assessment.publishedAt = new Date();
        assessment.publishedBy = hodUserId;
      } else {
        assessment.status = 'APPROVED';
      }

      await assessment.save({ transaction: t });

      // 2. Audit Trail: Approval Event
      await AssessmentReviewHistory.create(
        {
          assessmentConfigurationId: assessment.id,
          action: 'APPROVED',
          fromStatus,
          toStatus: 'APPROVED',
          actorId: hodUserId,
          actorRole: 'HOD',
          actorName: hodName,
          comments: 'Assessment CIE marks approved by Head of Department.',
          metadata: {
            approvedAt: assessment.approvedAt,
            studentsCount: summariesCount,
          },
        },
        { transaction: t }
      );

      // 3. Audit Trail: Publication Event (if published)
      if (shouldPublish) {
        await AssessmentReviewHistory.create(
          {
            assessmentConfigurationId: assessment.id,
            action: 'PUBLISHED',
            fromStatus: 'APPROVED',
            toStatus: 'PUBLISHED',
            actorId: hodUserId,
            actorRole: 'HOD',
            actorName: hodName,
            comments: 'Assessment CIE marks published to Student Dashboard.',
            metadata: {
              publishedAt: assessment.publishedAt,
              studentsCount: summariesCount,
            },
          },
          { transaction: t }
        );
      }

      await t.commit();

      logger.info(
        `EVENT: ASSESSMENT_APPROVED_AND_PUBLISHED | Config: ${assessment.id} | Subject: ${assessment.subject?.code} | HOD: ${hodUserId}`
      );

      return {
        success: true,
        message: shouldPublish
          ? 'Assessment marks approved and published successfully. Results are now visible to students.'
          : 'Assessment marks approved successfully.',
        assessment,
      };
    } catch (err: any) {
      await t.rollback();
      logger.error('APPROVE_PUBLISH_TRANSACTION_ERROR:', err);
      throw err;
    }
  }

  /**
   * HOD Action: Return Assessment for Correction
   * Requires non-empty meaningful comment. Unlocks faculty editing.
   */
  async returnAssessmentForCorrection(
    hodUserId: string,
    assessmentId: string,
    comment: string
  ): Promise<{ success: boolean; message: string; assessment: AssessmentConfiguration }> {
    const cleanComment = (comment || '').trim();
    if (!cleanComment || cleanComment.length < 5) {
      throw new Error('A detailed correction comment (minimum 5 characters) is required when returning marks.');
    }

    const assessment = await AssessmentConfiguration.findByPk(assessmentId, {
      include: [{ model: Subject, as: 'subject' }, { model: Department, as: 'department' }],
    });

    if (!assessment) {
      throw new Error('Assessment not found.');
    }

    const authCheck = await this.validateHodAuthorization(hodUserId, assessment);
    if (!authCheck.authorized) {
      throw new Error(authCheck.reason || 'You are not authorized to return this assessment.');
    }

    if (!['SUBMITTED', 'RESUBMITTED'].includes(assessment.status)) {
      throw new Error(
        `Assessment cannot be returned because it is currently in "${assessment.status}" status.`
      );
    }

    const hodUser = await User.findByPk(hodUserId);
    const hodName = hodUser ? `${hodUser.firstName} ${hodUser.lastName || ''}`.trim() : 'HOD';

    const t = await db.transaction();
    try {
      const fromStatus = assessment.status;
      assessment.status = 'RETURNED';
      assessment.hodReviewComment = cleanComment;
      assessment.reviewedAt = new Date();
      assessment.reviewedBy = hodUserId;
      await assessment.save({ transaction: t });

      await AssessmentReviewHistory.create(
        {
          assessmentConfigurationId: assessment.id,
          action: 'RETURNED',
          fromStatus,
          toStatus: 'RETURNED',
          actorId: hodUserId,
          actorRole: 'HOD',
          actorName: hodName,
          comments: cleanComment,
          metadata: {
            returnedAt: assessment.reviewedAt,
            subjectCode: assessment.subject?.code,
          },
        },
        { transaction: t }
      );

      await t.commit();

      logger.info(
        `EVENT: ASSESSMENT_RETURNED | Config: ${assessment.id} | Subject: ${assessment.subject?.code} | HOD: ${hodUserId} | Comment: ${cleanComment}`
      );

      return {
        success: true,
        message: 'Assessment returned to faculty for correction with comments recorded.',
        assessment,
      };
    } catch (err: any) {
      await t.rollback();
      logger.error('RETURN_ASSESSMENT_TRANSACTION_ERROR:', err);
      throw err;
    }
  }
}

export default new AssessmentWorkflowService();
