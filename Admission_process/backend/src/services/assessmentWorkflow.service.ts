import { Op } from 'sequelize';
import db from '../config/database';
import AssessmentConfiguration from '../models/AssessmentConfiguration';
import AssessmentReviewHistory from '../models/AssessmentReviewHistory';
import Subject from '../models/Subject';
import Department from '../models/Department';
import HOD from '../models/HOD';
import User from '../models/User';
import FacultyAssignment from '../models/FacultyAssignment';
import StudentAssessmentSummary from '../models/StudentAssessmentSummary';
import logger from '../utils/logger.util';

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
    subjectId?: string,
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
}

export default new AssessmentWorkflowService();

