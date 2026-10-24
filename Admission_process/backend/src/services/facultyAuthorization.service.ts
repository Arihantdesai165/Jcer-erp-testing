import { Op, Transaction } from 'sequelize';
import db from '../config/database';
import FacultyAuthorizationRequest from '../models/FacultyAuthorizationRequest';
import User from '../models/User';
import Teacher from '../models/Teacher';
import Department from '../models/Department';
import Subject from '../models/Subject';
import AuditLog from '../models/AuditLog';
import Notification from '../models/Notification';
import logger from '../utils/logger.util';

export interface ApproverContext {
  id: string;
  role: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ParallelAuthSummary {
  overallStatus: 'PENDING_APPROVAL' | 'AUTHORIZED' | 'REJECTED' | string;
  firstApprovedBy: string | null;
  firstApprovedRole: string | null;
  firstApprovedAt: Date | null;
  deanApproval: {
    id?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
    decidedByName: string | null;
    decidedByRole: string | null;
    decidedAt: Date | null;
    rejectionReason: string | null;
  } | null;
  principalApproval: {
    id?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
    decidedByName: string | null;
    decidedByRole: string | null;
    decidedAt: Date | null;
    rejectionReason: string | null;
  } | null;
}

class FacultyAuthorizationService {
  /**
   * Helper to create parallel requests for Dean and Principal simultaneously
   */
  async createParallelRequests(
    params: {
      facultyUserId: string;
      departmentId: string;
      designation?: string;
      createdByHODId: string;
      academicYear?: string;
      semester?: number;
      section?: string;
    },
    transaction?: Transaction
  ): Promise<{ deanRequest: FacultyAuthorizationRequest; principalRequest: FacultyAuthorizationRequest }> {
    const t = transaction || (await db.transaction());
    const isExternalTx = Boolean(transaction);

    try {
      const year = params.academicYear || '2026-27';
      const desig = params.designation || 'Assistant Professor';

      // 1. Create Dean Authorization Request
      const deanRequest = await FacultyAuthorizationRequest.create(
        {
          facultyUserId: params.facultyUserId,
          departmentId: params.departmentId,
          subjectId: null,
          semester: params.semester || 1,
          section: params.section || 'A',
          academicYear: year,
          designation: desig,
          createdByHODId: params.createdByHODId,
          authority: 'DEAN',
          sequence: 1,
          status: 'PENDING',
          overallStatus: 'PENDING_APPROVAL',
        },
        { transaction: t }
      );

      // 2. Create Principal Authorization Request (Parallel, immediately PENDING)
      const principalRequest = await FacultyAuthorizationRequest.create(
        {
          facultyUserId: params.facultyUserId,
          departmentId: params.departmentId,
          subjectId: null,
          semester: params.semester || 1,
          section: params.section || 'A',
          academicYear: year,
          designation: desig,
          createdByHODId: params.createdByHODId,
          authority: 'PRINCIPAL',
          sequence: 1,
          status: 'PENDING',
          overallStatus: 'PENDING_APPROVAL',
        },
        { transaction: t }
      );

      if (!isExternalTx) {
        await t.commit();
      }

      // Dispatch parallel notifications in background
      this.notifyApproversOnCreation(params.facultyUserId, desig, params.createdByHODId).catch((err) =>
        logger.error('Failed to notify approvers on faculty creation:', err)
      );

      return { deanRequest, principalRequest };
    } catch (error) {
      if (!isExternalTx) {
        await t.rollback();
      }
      throw error;
    }
  }

  /**
   * Process an approval from either Dean or Principal.
   * Concurrency-safe: First approver establishes AUTHORIZED status and activates faculty immediately.
   * Second approver records subsequent approval without overwriting first approval metadata.
   */
  async approveRequest(params: {
    requestId: string;
    expectedAuthority: 'DEAN' | 'PRINCIPAL';
    approver: ApproverContext;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; message: string; isFirstApproval: boolean; data: any }> {
    const t = await db.transaction();

    try {
      // 1. Lock the target authorization request
      const authReq = await FacultyAuthorizationRequest.findByPk(params.requestId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!authReq) {
        await t.rollback();
        throw new Error('Authorization request not found.');
      }

      if (authReq.status === 'APPROVED') {
        await t.rollback();
        return {
          success: true,
          message: `This request has already been approved by ${authReq.authority === 'DEAN' ? 'Dean Academics' : 'Principal'}.`,
          isFirstApproval: false,
          data: authReq,
        };
      }

      const approverName =
        `${params.approver.firstName || ''} ${params.approver.lastName || ''}`.trim() ||
        (params.expectedAuthority === 'DEAN' ? 'Dean Academics' : 'Principal');
      const approverRole = params.expectedAuthority === 'DEAN' ? 'Dean Academics' : 'Principal';
      const now = new Date();

      // 2. Lock all authorization requests for this faculty user to prevent race condition
      const allFacultyRequests = await FacultyAuthorizationRequest.findAll({
        where: { facultyUserId: authReq.facultyUserId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // Check if any request for this faculty already has a first approval
      const existingFirstApprover = allFacultyRequests.find((r) => r.firstApprovedAt !== null || r.firstApprovedRole !== null);
      const isFirstApproval = !existingFirstApprover;

      const firstApprovedByUserId = existingFirstApprover ? existingFirstApprover.firstApprovedByUserId : params.approver.id;
      const firstApprovedByName = existingFirstApprover ? existingFirstApprover.firstApprovedByName : approverName;
      const firstApprovedRole = existingFirstApprover ? existingFirstApprover.firstApprovedRole : approverRole;
      const firstApprovedAt = existingFirstApprover ? existingFirstApprover.firstApprovedAt : now;

      // 3. Update current authority's request
      await authReq.update(
        {
          status: 'APPROVED',
          decidedByUserId: params.approver.id,
          decidedByName: approverName,
          decidedByRole: approverRole,
          decidedAt: now,
          rejectionReason: null,
          overallStatus: 'AUTHORIZED',
          firstApprovedByUserId,
          firstApprovedByName,
          firstApprovedRole,
          firstApprovedAt,
        },
        { transaction: t }
      );

      // 4. Propagate overallStatus & firstApproved* to all sibling requests for this faculty
      for (const sibling of allFacultyRequests) {
        if (sibling.id !== authReq.id) {
          await sibling.update(
            {
              overallStatus: 'AUTHORIZED',
              firstApprovedByUserId,
              firstApprovedByName,
              firstApprovedRole,
              firstApprovedAt,
            },
            { transaction: t }
          );
        }
      }

      // 5. Activate User & Teacher record immediately
      await User.update(
        { status: 'ACTIVE', accountStatus: 'ACTIVE' } as any,
        { where: { id: authReq.facultyUserId }, transaction: t }
      );

      let teacher = await Teacher.findOne({
        where: { userId: authReq.facultyUserId },
        transaction: t,
      });

      if (!teacher) {
        teacher = await Teacher.create(
          {
            userId: authReq.facultyUserId,
            departmentId: authReq.departmentId,
            designation: authReq.designation || 'Assistant Professor',
            joiningDate: new Date(),
            cycle: null,
          },
          { transaction: t }
        );
      }

      // 6. Record Audit Log
      await AuditLog.create(
        {
          userId: params.approver.id,
          action: isFirstApproval ? 'APPROVE_FACULTY_FIRST_AUTHORIZATION' : 'APPROVE_FACULTY_SUBSEQUENT_AUTHORIZATION',
          ipAddress: params.ipAddress || '127.0.0.1',
          userAgent: params.userAgent || 'System',
          details: {
            facultyUserId: authReq.facultyUserId,
            requestId: authReq.id,
            authority: params.expectedAuthority,
            approverName,
            isFirstApproval,
            firstApprovedBy: firstApprovedByName,
            firstApprovedRole,
            firstApprovedAt,
          },
        },
        { transaction: t }
      );

      await t.commit();

      // Dispatch notifications in background
      this.notifyOnApproval(authReq, approverName, approverRole, isFirstApproval).catch((err) =>
        logger.error('Failed to dispatch approval notification:', err)
      );

      return {
        success: true,
        message: isFirstApproval
          ? `Faculty authorization approved by ${approverRole}. Account activated successfully.`
          : `Subsequent approval recorded by ${approverRole}.`,
        isFirstApproval,
        data: {
          requestId: authReq.id,
          facultyUserId: authReq.facultyUserId,
          overallStatus: 'AUTHORIZED',
          firstApprovedByName,
          firstApprovedRole,
          firstApprovedAt,
          status: 'APPROVED',
        },
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Process a rejection from Dean or Principal.
   * Maintains separate authority-level decision. If the other authority already approved, overall status remains AUTHORIZED.
   */
  async rejectRequest(params: {
    requestId: string;
    expectedAuthority: 'DEAN' | 'PRINCIPAL';
    reason: string;
    approver: ApproverContext;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; message: string; data: any }> {
    const t = await db.transaction();

    try {
      const authReq = await FacultyAuthorizationRequest.findByPk(params.requestId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!authReq) {
        await t.rollback();
        throw new Error('Authorization request not found.');
      }

      if (authReq.status === 'REJECTED') {
        await t.rollback();
        return {
          success: true,
          message: `This request has already been rejected by ${authReq.authority === 'DEAN' ? 'Dean Academics' : 'Principal'}.`,
          data: authReq,
        };
      }

      const rejecterName =
        `${params.approver.firstName || ''} ${params.approver.lastName || ''}`.trim() ||
        (params.expectedAuthority === 'DEAN' ? 'Dean Academics' : 'Principal');
      const rejecterRole = params.expectedAuthority === 'DEAN' ? 'Dean Academics' : 'Principal';
      const now = new Date();

      // 1. Update this authority's request to REJECTED
      await authReq.update(
        {
          status: 'REJECTED',
          rejectionReason: params.reason.trim(),
          decidedByUserId: params.approver.id,
          decidedByName: rejecterName,
          decidedByRole: rejecterRole,
          decidedAt: now,
        },
        { transaction: t }
      );

      // 2. Inspect all requests for this faculty to compute overallStatus
      const allFacultyRequests = await FacultyAuthorizationRequest.findAll({
        where: { facultyUserId: authReq.facultyUserId },
        transaction: t,
      });

      const hasApproval = allFacultyRequests.some((r) => r.status === 'APPROVED');
      const allRejected = allFacultyRequests.every((r) => r.status === 'REJECTED');

      let computedOverall = 'PENDING_APPROVAL';
      if (hasApproval) {
        computedOverall = 'AUTHORIZED';
      } else if (allRejected) {
        computedOverall = 'REJECTED';
      }

      // Update overall status on this request
      await authReq.update({ overallStatus: computedOverall }, { transaction: t });

      // If all authorities have rejected and there's no approval, mark User as REJECTED
      if (allRejected && !hasApproval) {
        await User.update(
          { status: 'REJECTED', accountStatus: 'REJECTED' } as any,
          { where: { id: authReq.facultyUserId }, transaction: t }
        );
      }

      // 3. Record Audit Log
      await AuditLog.create(
        {
          userId: params.approver.id,
          action: 'REJECT_FACULTY_AUTHORIZATION',
          ipAddress: params.ipAddress || '127.0.0.1',
          userAgent: params.userAgent || 'System',
          details: {
            facultyUserId: authReq.facultyUserId,
            requestId: authReq.id,
            authority: params.expectedAuthority,
            rejecterName,
            reason: params.reason,
            computedOverall,
          },
        },
        { transaction: t }
      );

      await t.commit();

      return {
        success: true,
        message: `Faculty request rejected by ${rejecterRole}.`,
        data: {
          requestId: authReq.id,
          facultyUserId: authReq.facultyUserId,
          status: 'REJECTED',
          overallStatus: computedOverall,
        },
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Get complete multi-authority summary for a faculty user
   */
  async getFacultyAuthorizationSummary(facultyUserId: string): Promise<ParallelAuthSummary> {
    const requests = await FacultyAuthorizationRequest.findAll({
      where: { facultyUserId },
      order: [['createdAt', 'DESC']],
    });

    const deanReq = requests.find((r) => r.authority === 'DEAN');
    const principalReq = requests.find((r) => r.authority === 'PRINCIPAL');

    // First approver determination
    const firstReq = requests.find((r) => r.firstApprovedAt !== null);

    let overallStatus = 'PENDING_APPROVAL';
    if (requests.some((r) => r.status === 'APPROVED' || r.overallStatus === 'AUTHORIZED')) {
      overallStatus = 'AUTHORIZED';
    } else if (requests.length > 0 && requests.every((r) => r.status === 'REJECTED')) {
      overallStatus = 'REJECTED';
    }

    return {
      overallStatus,
      firstApprovedBy: firstReq?.firstApprovedByName || null,
      firstApprovedRole: firstReq?.firstApprovedRole || null,
      firstApprovedAt: firstReq?.firstApprovedAt || null,
      deanApproval: deanReq
        ? {
            id: deanReq.id,
            status: deanReq.status,
            decidedByName: deanReq.decidedByName,
            decidedByRole: deanReq.decidedByRole,
            decidedAt: deanReq.decidedAt,
            rejectionReason: deanReq.rejectionReason,
          }
        : null,
      principalApproval: principalReq
        ? {
            id: principalReq.id,
            status: principalReq.status,
            decidedByName: principalReq.decidedByName,
            decidedByRole: principalReq.decidedByRole,
            decidedAt: principalReq.decidedAt,
            rejectionReason: principalReq.rejectionReason,
          }
        : null,
    };
  }

  /**
   * Helper to format requests for listing in Dean/Principal dashboards
   */
  async formatRequestForQueue(
    item: FacultyAuthorizationRequest,
    currentAuthority: 'DEAN' | 'PRINCIPAL'
  ): Promise<any> {
    const facultyUser: any = (item as any).faculty;
    const department: any = (item as any).department;
    const subject: any = (item as any).subject;
    const createdByHOD: any = (item as any).createdByHOD;
    const decidedBy: any = (item as any).decidedBy;

    // Load other authority's record
    const otherAuthority = currentAuthority === 'DEAN' ? 'PRINCIPAL' : 'DEAN';
    const otherReq = await FacultyAuthorizationRequest.findOne({
      where: {
        facultyUserId: item.facultyUserId,
        authority: otherAuthority,
      },
    });

    const isCurrentApproved = item.status === 'APPROVED';
    const isCurrentRejected = item.status === 'REJECTED';
    const isCurrentPending = item.status === 'PENDING';

    const isOtherApproved = otherReq?.status === 'APPROVED';
    const isOtherRejected = otherReq?.status === 'REJECTED';

    const isOverallAuthorized = item.overallStatus === 'AUTHORIZED' || isCurrentApproved || isOtherApproved;

    // Display status label
    let displayStatus = 'PENDING';
    if (isOverallAuthorized) {
      if (isCurrentApproved && isOtherApproved) {
        displayStatus = 'BOTH_APPROVED';
      } else if (item.firstApprovedRole) {
        displayStatus = `AUTHORIZED_BY_${item.firstApprovedRole.toUpperCase().replace(/\s+/g, '_')}`;
      } else if (isCurrentApproved) {
        displayStatus = `AUTHORIZED_BY_${currentAuthority}`;
      } else if (isOtherApproved) {
        displayStatus = `AUTHORIZED_BY_${otherAuthority}`;
      } else {
        displayStatus = 'AUTHORIZED';
      }
    } else if (isCurrentRejected && isOtherRejected) {
      displayStatus = 'REJECTED';
    } else if (isCurrentRejected) {
      displayStatus = 'REJECTED_BY_YOU';
    }

    return {
      id: item.id,
      facultyId: item.facultyUserId,
      facultyName: facultyUser ? `${facultyUser.firstName || ''} ${facultyUser.lastName || ''}`.trim() : 'Faculty Candidate',
      email: facultyUser?.email || '',
      phone: facultyUser?.phone || '',
      profileImage: facultyUser?.profileImage || '',
      departmentId: item.departmentId,
      departmentName: department?.name || 'Department',
      departmentCode: department?.code || 'N/A',
      subjectId: item.subjectId,
      subjectName: subject?.name || 'General Assignment',
      subjectCode: subject?.code || 'N/A',
      semester: item.semester,
      section: item.section,
      academicYear: item.academicYear,
      designation: item.designation,
      authority: item.authority,
      status: item.status, // authority-specific: PENDING | APPROVED | REJECTED
      overallStatus: isOverallAuthorized ? 'AUTHORIZED' : item.overallStatus,
      displayStatus,
      firstApprovedByName: item.firstApprovedByName,
      firstApprovedRole: item.firstApprovedRole,
      firstApprovedAt: item.firstApprovedAt,
      isFirstApproval: Boolean(item.firstApprovedAt),
      rejectionReason: item.rejectionReason,
      createdBy: createdByHOD ? `${createdByHOD.firstName || ''} ${createdByHOD.lastName || ''}`.trim() : 'HOD',
      createdDate: item.createdAt,
      decidedBy: item.decidedByName || (decidedBy ? `${decidedBy.firstName} ${decidedBy.lastName}` : null),
      decidedAt: item.decidedAt,
      canApprove: isCurrentPending,
      canReject: isCurrentPending,
      deanApproval: currentAuthority === 'DEAN'
        ? {
            status: item.status,
            decidedByName: item.decidedByName,
            decidedByRole: item.decidedByRole || 'Dean Academics',
            decidedAt: item.decidedAt,
            rejectionReason: item.rejectionReason,
          }
        : otherReq
        ? {
            status: otherReq.status,
            decidedByName: otherReq.decidedByName,
            decidedByRole: otherReq.decidedByRole || 'Dean Academics',
            decidedAt: otherReq.decidedAt,
            rejectionReason: otherReq.rejectionReason,
          }
        : null,
      principalApproval: currentAuthority === 'PRINCIPAL'
        ? {
            status: item.status,
            decidedByName: item.decidedByName,
            decidedByRole: item.decidedByRole || 'Principal',
            decidedAt: item.decidedAt,
            rejectionReason: item.rejectionReason,
          }
        : otherReq
        ? {
            status: otherReq.status,
            decidedByName: otherReq.decidedByName,
            decidedByRole: otherReq.decidedByRole || 'Principal',
            decidedAt: otherReq.decidedAt,
            rejectionReason: otherReq.rejectionReason,
          }
        : null,
    };
  }

  private async notifyApproversOnCreation(facultyUserId: string, designation: string, hodUserId: string) {
    const faculty = await User.findByPk(facultyUserId);
    const facultyName = faculty ? `${faculty.firstName} ${faculty.lastName}`.trim() : 'Faculty Candidate';

    const approvers = await User.findAll({
      where: {
        role: { [Op.in]: ['DEAN', 'PRINCIPAL'] },
        status: 'ACTIVE',
      },
    });

    const notifTitle = 'New Faculty Authorization Request';
    const notifContent = `A new faculty creation request for ${facultyName} (${designation}) was submitted by HOD. Available for direct review and authorization.`;

    for (const approver of approvers) {
      await Notification.create({
        userId: approver.id,
        title: notifTitle,
        content: notifContent,
        type: 'FACULTY_AUTHORIZATION',
        referenceId: facultyUserId,
      });
    }
  }

  private async notifyOnApproval(
    authReq: FacultyAuthorizationRequest,
    approverName: string,
    approverRole: string,
    isFirstApproval: boolean
  ) {
    const faculty = await User.findByPk(authReq.facultyUserId);
    const facultyName = faculty ? `${faculty.firstName} ${faculty.lastName}`.trim() : 'Faculty member';

    // Notify HOD
    if (authReq.createdByHODId) {
      await Notification.create({
        userId: authReq.createdByHODId,
        title: isFirstApproval ? 'Faculty Candidate Authorized' : 'Subsequent Faculty Approval Recorded',
        content: isFirstApproval
          ? `Faculty ${facultyName} has been authorized and activated by ${approverRole} (${approverName}).`
          : `Subsequent approval for ${facultyName} was recorded by ${approverRole} (${approverName}).`,
        type: 'FACULTY_AUTHORIZATION',
        referenceId: authReq.facultyUserId,
      });
    }
  }
}

export const facultyAuthorizationService = new FacultyAuthorizationService();
export default facultyAuthorizationService;
