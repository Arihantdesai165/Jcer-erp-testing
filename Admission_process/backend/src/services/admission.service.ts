import { Op, Sequelize, Transaction } from 'sequelize';
import fs from 'fs';
import path from 'path';
import Admission from '../models/Admission';
import AdmissionPersonalDetail from '../models/AdmissionPersonalDetail';
import AdmissionParentDetail from '../models/AdmissionParentDetail';
import AdmissionAddress from '../models/AdmissionAddress';
import AdmissionAcademicDetail from '../models/AdmissionAcademicDetail';
import AdmissionDocument from '../models/AdmissionDocument';
import Department from '../models/Department';
import User from '../models/User';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import UsnRegistry from '../models/UsnRegistry';
import RejectionReason from '../models/RejectionReason';
import SystemConfiguration from '../models/SystemConfiguration';
import AdmissionSequence from '../models/AdmissionSequence';
import ProvisionalAdmission from '../models/ProvisionalAdmission';
import db from '../config/database';
import { ForbiddenException } from '../utils/error.util';
import redisService from './redis.service';
import emailService from './email.service';
import { calculateStudentCohort, formatBatchCohort } from '../utils/batchCohort.util';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a unique Admission Number in format:
 * JCER-{AdmissionYear}-{BranchCode}-{Sequence}
 * Example: JCER-2028-CSE-00001
 * 
 * Rules:
 * - AdmissionYear: Start year of active Academic Year (e.g., "2028-2029" -> "2028")
 * - BranchCode: Code from Department master (e.g., "CSE", "ECE", "AIML"). Default "GEN" if branch not yet selected.
 * - Sequence: Production-safe atomic sequence using dedicated AdmissionSequence row-locking.
 */
async function generateAdmissionNumber(
  academicYear: string,
  branchId?: string | number | null,
  t?: Transaction
): Promise<string> {
  const startYear = academicYear ? academicYear.split(/[-–]/)[0].trim() : String(new Date().getFullYear());
  
  let branchCode = 'GEN';
  if (branchId) {
    const branch = await Department.findByPk(String(branchId));
    if (branch && branch.code) {
      branchCode = branch.code.toUpperCase();
    }
  }

  const executeAtomicIncrement = async (transaction: Transaction) => {
    let seqRecord = await AdmissionSequence.findOne({
      where: { academicYear },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!seqRecord) {
      seqRecord = await AdmissionSequence.create(
        { academicYear, lastSequence: 0 },
        { transaction }
      );
      seqRecord = await AdmissionSequence.findOne({
        where: { academicYear },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    const nextSeq = (seqRecord ? seqRecord.lastSequence : 0) + 1;
    if (seqRecord) {
      seqRecord.lastSequence = nextSeq;
      await seqRecord.save({ transaction });
    }

    return String(nextSeq).padStart(5, '0');
  };

  let seqStr: string;
  if (t) {
    seqStr = await executeAtomicIncrement(t);
  } else {
    seqStr = await db.transaction(async (transaction) => {
      return await executeAtomicIncrement(transaction);
    });
  }

  return `JCER-${startYear}-${branchCode}-${seqStr}`;
}



// ─── Full detail loader ──────────────────────────────────────────────────────

async function loadFullAdmission(admission: Admission) {
  const [
    user,
    branch,
    personal,
    parent,
    address,
    academic,
    documents
  ] = await Promise.all([
    User.findByPk(admission.userId, { attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'profileImage'] }),
    admission.branchId ? Department.findByPk(admission.branchId) : Promise.resolve(null),
    AdmissionPersonalDetail.findOne({ where: { admissionId: admission.id } }),
    AdmissionParentDetail.findOne({ where: { admissionId: admission.id } }),
    AdmissionAddress.findOne({ where: { admissionId: admission.id } }),
    AdmissionAcademicDetail.findOne({ where: { admissionId: admission.id } }),
    AdmissionDocument.findOne({ where: { admissionId: admission.id } }),
  ]);

  const rawAdmission = admission.get({ plain: true });
  rawAdmission.user = user ? (user.toJSON ? user.toJSON() : user) : null;
  rawAdmission.branch = branch ? (branch.toJSON ? branch.toJSON() : branch) : null;
  rawAdmission.studentpersonaldetails = personal ? (personal.toJSON ? personal.toJSON() : personal) : null;
  rawAdmission.studentparentdetails = parent ? (parent.toJSON ? parent.toJSON() : parent) : null;
  rawAdmission.studentaddress = address ? (address.toJSON ? address.toJSON() : address) : null;
  rawAdmission.studentacademicdetails = academic ? (academic.toJSON ? academic.toJSON() : academic) : null;
  rawAdmission.studentdocuments = documents ? (documents.toJSON ? documents.toJSON() : documents) : null;

  return rawAdmission;
}

function serializeAdmission(admission: any): any {
  if (!admission) return null;
  const data = admission.toJSON ? admission.toJSON() : JSON.parse(JSON.stringify(admission));
  if (!data.usn && data.user?.student?.usn) {
    data.usn = data.user.student.usn;
  }
  if (data.studentacademicdetails) {
    const acad = data.studentacademicdetails;
    // Map tenth to sslc
    acad.sslcSchool = acad.tenthSchool;
    acad.sslcBoard = acad.tenthBoard;
    acad.sslcYear = acad.tenthPassingYear;
    acad.sslcRegisterNumber = acad.tenthRegisterNumber;
    acad.sslcMarksObtained = acad.tenthMarksObtained;
    acad.sslcMaxMarks = acad.tenthMaxMarks;
    acad.sslcPercentage = acad.tenthPercentage;
    acad.sslcAttempts = acad.tenthAttempts;

    // Map twelfth to puc
    acad.pucSchool = acad.twelfthSchool;
    acad.pucBoard = acad.twelfthBoard;
    acad.pucYear = acad.twelfthPassingYear;
    acad.pucRegisterNumber = acad.twelfthRegisterNumber;
    acad.pucStream = acad.twelfthStream;
    acad.physicsMarks = acad.physicsMarks;
    acad.mathsMarks = acad.mathsMarks;
    acad.chemistryMarks = acad.chemistryMarks;
    acad.optionalSubject = acad.optionalSubject;
    acad.optionalMarks = acad.optionalMarks;
    acad.pucMaxMarks = acad.twelfthMaxMarks;
    acad.pucAggregate = acad.twelfthAggregate;
    acad.pucPercentage = acad.twelfthPercentage;
    acad.pucAttempts = acad.twelfthAttempts;
  }
  if (data.studentdocuments) {
    data.documents = data.studentdocuments;
  }
  return data;
}

// ─── Step Status ─────────────────────────────────────────────────────────────

function computeStepStatus(admission: any) {
  const pd = admission?.studentpersonaldetails;
  const par = admission?.studentparentdetails;
  const addr = admission?.studentaddress;
  const acad = admission?.studentacademicdetails;
  const docs = admission?.studentdocuments;

  const isLateral = admission?.qualification === 'DIPLOMA' || (!admission?.qualification && admission?.admissionType === 'DCET');

  const steps = [
    { step: 1, completed: !!(admission?.admissionType && admission?.aadhaar && admission?.branchId && admission?.qualification) },
    { step: 2, completed: !!(pd?.firstName && pd?.dateOfBirth && pd?.gender) },
    { step: 3, completed: !!(par?.fatherName && par?.fatherPhone) },
    { step: 4, completed: !!(addr?.currentAddressLine1 && addr?.currentCity && addr?.currentPincode) },
    // Diploma students fill Diploma details, not PUC/12th
    { step: 5, completed: isLateral
        ? !!(acad?.tenthPercentage && acad?.diplomaPercentage)
        : !!(acad?.tenthPercentage && acad?.twelfthPercentage) },
    { step: 6, completed: isLateral
        ? !!(docs?.photoUrl && docs?.tenthMarksheetUrl && docs?.diplomaSemester5MarksheetUrl && docs?.diplomaSemester6MarksheetUrl && docs?.feesPaidReceiptUrl)
        : !!(docs?.photoUrl && docs?.tenthMarksheetUrl && docs?.twelfthMarksheetUrl && docs?.feesPaidReceiptUrl) },
    { step: 7, completed: admission?.applicationStatus !== 'DRAFT' },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const activeStepIndex = steps.findIndex((s) => !s.completed) + 1 || 7;

  // Self-heal requested sections by checking them dynamically against actual remarks content
  const remarksLower = (admission?.correctionRemarks || admission?.adminRemarks || '').toLowerCase();
  const requestedRaw = admission?.correctionRequestedSections || [];
  const requested = requestedRaw.filter((sectionKey: string) => {
    if (sectionKey === 'documents') return true;
    if (sectionKey === 'admission') {
      const keywords = ['admission type', 'preferred branch', 'branch', 'aadhaar', 'qualification', 'cet number', 'dcet number'];
      return keywords.some(kw => remarksLower.includes(kw));
    }
    if (sectionKey === 'personal') {
      const keywords = ['first name', 'middle name', 'last name', 'gender', 'birth', 'dob', 'nationality', 'religion', 'caste', 'category', 'area type', 'email', 'mobile number', 'phone'];
      return keywords.some(kw => remarksLower.includes(kw));
    }
    if (sectionKey === 'parent') {
      const keywords = ['father', 'mother', 'parent', 'guardian', 'annual income'];
      return keywords.some(kw => remarksLower.includes(kw));
    }
    if (sectionKey === 'address') {
      const keywords = ['address', 'residence', 'pincode', 'city', 'state', 'taluk', 'district', 'village', 'street'];
      return keywords.some(kw => remarksLower.includes(kw));
    }
    if (sectionKey === 'academic') {
      const keywords = ['school', 'board', 'passing year', 'register number', 'marks', 'attempts', 'percentage', 'university', 'puc', 'diploma', 'cet', 'dcet'];
      return keywords.some(kw => remarksLower.includes(kw));
    }
    return true;
  });

  // Map each step to COMPLETED | ACTIVE | LOCKED | CORRECTION_REQUIRED
  const stepStatus: Record<number, string> = {};
  if (admission?.applicationStatus === 'CORRECTION_REQUIRED') {
    const keyMap = { 1: 'admission', 2: 'personal', 3: 'parent', 4: 'address', 5: 'academic', 6: 'documents' };
    for (let i = 1; i <= 6; i++) {
      const stepKey = keyMap[i as 1|2|3|4|5|6];
      if (requested.includes(stepKey)) {
        stepStatus[i] = 'CORRECTION_REQUIRED';
      } else {
        stepStatus[i] = 'COMPLETED';
      }
    }
    stepStatus[7] = 'ACTIVE';
  } else {
    for (let i = 1; i <= 7; i++) {
      if (steps[i - 1].completed) {
        stepStatus[i] = 'COMPLETED';
      } else if (i === activeStepIndex) {
        stepStatus[i] = 'ACTIVE';
      } else {
        stepStatus[i] = 'LOCKED';
      }
    }
  }

  const timeline: any = {};
  if (admission?.submittedAt) {
    timeline.submittedAt = admission.submittedAt;
  }
  if (admission?.resubmittedAt) {
    timeline.resubmittedAt = admission.resubmittedAt;
  }
  if (admission?.correctionRequestedAt) {
    timeline.correctionRequestedAt = admission.correctionRequestedAt;
  }
  
  const resubmittedAtTime = admission?.resubmittedAt ? new Date(admission.resubmittedAt).getTime() : 0;

  const isAfterResubmission = (dateVal: any) => {
    if (!dateVal) return false;
    if (!resubmittedAtTime) return true;
    return new Date(dateVal).getTime() >= resubmittedAtTime;
  };

  if (admission?.reviewedAt && isAfterResubmission(admission.reviewedAt)) {
    timeline.reviewStartedAt = admission.reviewedAt;
  } else if (['UNDER_REVIEW', 'APPROVED', 'PRINCIPAL_APPROVED', 'ENROLLED', 'REJECTED', 'CANCELLATION_REQUESTED', 'CANCELLED'].includes(admission?.applicationStatus)) {
    timeline.reviewStartedAt = admission?.reviewedAt || admission?.submittedAt || admission?.updatedAt;
  }

  if (admission?.verifiedAt && isAfterResubmission(admission.verifiedAt)) {
    timeline.documentsVerifiedAt = admission.verifiedAt;
    timeline.approvedAt = admission.verifiedAt;
    timeline.forwardedToPrincipalAt = admission.verifiedAt;
  } else if (['APPROVED', 'PRINCIPAL_APPROVED', 'ENROLLED'].includes(admission?.applicationStatus) || (['CANCELLATION_REQUESTED', 'CANCELLED'].includes(admission?.applicationStatus) && admission?.verifiedAt)) {
    timeline.documentsVerifiedAt = admission?.verifiedAt || admission?.reviewedAt || admission?.updatedAt;
    timeline.approvedAt = admission?.verifiedAt || admission?.reviewedAt || admission?.updatedAt;
    timeline.forwardedToPrincipalAt = admission?.verifiedAt || admission?.reviewedAt || admission?.updatedAt;
  }

  if (admission?.principalApprovedAt && isAfterResubmission(admission.principalApprovedAt)) {
    timeline.principalApprovedAt = admission.principalApprovedAt;
  } else if (['PRINCIPAL_APPROVED', 'ENROLLED'].includes(admission?.applicationStatus) || (['CANCELLATION_REQUESTED', 'CANCELLED'].includes(admission?.applicationStatus) && admission?.principalApprovedAt)) {
    timeline.principalApprovedAt = admission?.principalApprovedAt || admission?.principalReviewedAt || admission?.updatedAt;
  }

  if (admission?.enrolledAt && isAfterResubmission(admission.enrolledAt)) {
    timeline.usnAssignedAt = admission.enrolledAt;
  } else if (admission?.applicationStatus === 'ENROLLED' || (['CANCELLATION_REQUESTED', 'CANCELLED'].includes(admission?.applicationStatus) && admission?.enrolledAt)) {
    timeline.usnAssignedAt = admission?.enrolledAt || admission?.updatedAt;
  }

  if (admission?.applicationStatus === 'REJECTED') {
    timeline.rejectedAt = admission?.reviewedAt || admission?.updatedAt;
  }
  if (admission?.cancellationRequestedAt || admission?.applicationStatus === 'CANCELLATION_REQUESTED' || admission?.applicationStatus === 'CANCELLED') {
    timeline.cancellationRequestedAt = admission?.cancellationRequestedAt || admission?.updatedAt;
  }
  if (admission?.cancellationApprovedAt || admission?.applicationStatus === 'CANCELLED') {
    timeline.cancellationApprovedAt = admission?.cancellationApprovedAt || admission?.updatedAt;
  }

  return {
    applicationStatus: admission?.applicationStatus || 'DRAFT',
    applicationNumber: admission?.applicationNumber || null,
    studentId: admission?.id || null,
    steps,
    stepStatus,
    completedCount,
    totalSteps: 7,
    progressPercent: Math.round((completedCount / 7) * 100),
    activeStepIndex,
    adminRemarks: admission?.adminRemarks || admission?.correctionRemarks || null,
    rejectionReason: admission?.rejectionReason || null,
    rejectionReasonCode: admission?.rejectionReasonCode || null,
    feeReceiptUploadedAt: admission?.feeReceiptUploadedAt || null,
    admissionFeeReceiptUrl: admission?.admissionFeeReceiptUrl || null,
    feeVerifiedAt: admission?.feeVerifiedAt || null,
    feeVerificationRemarks: admission?.feeVerificationRemarks || null,
    feeRejectionReason: admission?.feeRejectionReason || null,
    cancellationReason: admission?.cancellationReason || null,
    cancellationRemarks: admission?.cancellationRemarks || null,
    cancellationRequestedAt: admission?.cancellationRequestedAt || null,
    cancellationApprovedAt: admission?.cancellationApprovedAt || null,
    cancellationApprovedById: admission?.cancellationApprovedById || null,
    cancellationAdminRemarks: admission?.cancellationAdminRemarks || null,
    correctionRequestedSections: requested,
    correctionRemarks: admission?.correctionRemarks || admission?.adminRemarks || null,
    correctionDeadline: admission?.correctionDeadline || null,
    correctionRequestedAt: admission?.correctionRequestedAt || null,
    verifiedDocuments: admission?.verifiedDocuments || null,
    timeline,
  };
}

// ─── Service Methods ─────────────────────────────────────────────────────────

class AdmissionService {
  public async invalidateCache(userId: string): Promise<void> {
    await Promise.all([
      redisService.deleteCache(`admission:status:${userId}`),
      redisService.deleteCache(`admission:full:${userId}`),
      redisService.deleteCache('admin:stats'),
    ]);
  }

  public async invalidateCacheByAdmissionId(admissionId: string): Promise<void> {
    const admission = await Admission.findByPk(admissionId, { attributes: ['userId'] });
    if (admission) {
      await this.invalidateCache(admission.userId);
    }
  }

  private checkEditable(admission: Admission, stepName?: string): void {
    if (admission.applicationStatus === 'CORRECTION_REQUIRED') {
      if (!stepName) return;
      const requestedSections = admission.correctionRequestedSections || [];
      if (requestedSections.length === 0) return;
      const normalizedStep = stepName === 'details' ? 'admission' : stepName;
      if (!requestedSections.includes(normalizedStep)) {
        throw new ForbiddenException('This section is locked and cannot be edited.');
      }
      return;
    }
    if (admission.applicationStatus !== 'DRAFT') {
      throw new ForbiddenException('This section is locked and cannot be edited.');
    }
  }

  private async markSectionCorrected(admission: Admission, stepName: string): Promise<void> {
    if (admission.applicationStatus === 'CORRECTION_REQUIRED') {
      const requested = admission.correctionRequestedSections || [];
      const normalizedStep = stepName === 'details' ? 'admission' : stepName;
      if (requested.includes(normalizedStep)) {
        const nextRequested = requested.filter((s: string) => s !== normalizedStep);
        await admission.update({ correctionRequestedSections: nextRequested });
      }
    }
  }

  /**
   * Get-or-create an Admission record for a user.
   * Called on first dashboard visit after registration.
   */
  async getOrCreate(userId: string): Promise<Admission> {
    // Resolve active admission by userId + status=DRAFT (DRAFT/REJECTED)
    let admission = await Admission.findOne({
      where: {
        userId,
        applicationStatus: { [Op.in]: ['DRAFT', 'REJECTED'] }
      }
    });

    // If no draft admission exists, fall back to any existing admission (e.g. submitted)
    if (!admission) {
      admission = await Admission.findOne({ where: { userId } });
    }

    if (!admission) {
      const config = await SystemConfiguration.findOne();
      const currentAcademicYear = config?.admissionCycle || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      const user = await User.findByPk(userId);
      const isLateral = user?.registrationType === 'LATERAL_ENTRY';

      admission = await Admission.create({
        userId,
        applicationNumber: null,
        academicYear: currentAcademicYear,
        applicationStatus: 'DRAFT',
        applicationType: isLateral ? 'LATERAL_ENTRY' : 'FRESH',
        entrySemester: isLateral ? 3 : 1,
      });
    } else if (!admission.academicYear) {
      const config = await SystemConfiguration.findOne();
      const currentAcademicYear = config?.admissionCycle || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      await admission.update({ academicYear: currentAcademicYear });
    }
    return admission;
  }

  /** Returns the minimal admission data (my-admission endpoint) */
  async getMyAdmission(userId: string): Promise<any> {
    const admission = await this.getOrCreate(userId);
    const full = await loadFullAdmission(admission);
    const serialized = serializeAdmission(full);

    // Dynamically sign R2 keys for student's own dashboard preview
    if (serialized.documents) {
      const { getSignedUrlSync } = require('./r2.service');
      const docFields = [
        'photoUrl', 'signatureUrl', 'tenthMarksheetUrl', 'twelfthMarksheetUrl',
        'diplomaSemester5MarksheetUrl', 'diplomaSemester6MarksheetUrl',
        'cetScoreCardUrl', 'aadhaarUrl', 'casteCertificateUrl', 'domicileCertificateUrl',
        'gapCertificateUrl', 'feesPaidReceiptUrl', 'admissionFeeReceiptUrl', 'admissionFormFeeReceiptUrl'
      ];
      for (const dbKey of docFields) {
        const val = serialized.documents[dbKey];
        if (val && !val.startsWith('/uploads') && !val.startsWith('uploads/')) {
          serialized.documents[dbKey] = getSignedUrlSync(val);
        }
      }
    }
    if (serialized.admissionFeeReceiptUrl && !serialized.admissionFeeReceiptUrl.startsWith('/uploads')) {
      const { getSignedUrlSync } = require('./r2.service');
      serialized.admissionFeeReceiptUrl = getSignedUrlSync(serialized.admissionFeeReceiptUrl);
    }
    return serialized;
  }

  /** Lazy-loads step-specific details for individual form step rendering */
  async getStepData(userId: string, stepName: string): Promise<any> {
    const admission = await this.getOrCreate(userId);
    
    switch (stepName) {
      case 'admission':
      case 'details': {
        const data = await Admission.findOne({
          where: { id: admission.id },
          attributes: ['id', 'userId', 'applicationNumber', 'admissionType', 'branchId', 'aadhaar', 'cetNumber', 'dcetNumber', 'applicationStatus', 'qualification']
        });
        return data;
      }
      case 'personal': {
        const personal = await AdmissionPersonalDetail.findOne({
          where: { admissionId: admission.id },
          attributes: ['id', 'admissionId', 'firstName', 'middleName', 'lastName', 'caste', 'dateOfBirth', 'gender', 'category', 'religion', 'nationality', 'studiedInKarnataka', 'areaType']
        });
        return personal;
      }
      case 'parent': {
        const data = await AdmissionParentDetail.findOne({
          where: { admissionId: admission.id },
          attributes: ['id', 'admissionId', 'fatherName', 'fatherPhone', 'fatherEmail', 'fatherOccupation', 'motherName', 'motherPhone', 'motherOccupation', 'fatherAnnualIncome']
        });
        return data;
      }
      case 'address': {
        const data = await AdmissionAddress.findOne({
          where: { admissionId: admission.id }
        });
        return data;
      }
      case 'academic': {
        const academic = await AdmissionAcademicDetail.findOne({
          where: { admissionId: admission.id },
          attributes: [
            'id', 'admissionId', 'tenthSchool', 'tenthBoard', 'tenthPassingYear', 'tenthRegisterNumber', 'tenthMarksObtained', 'tenthMaxMarks', 'tenthPercentage', 'tenthAttempts', 'tenthSubjectMarks',
            'twelfthSchool', 'twelfthBoard', 'twelfthPassingYear', 'twelfthRegisterNumber', 'twelfthStream', 'physicsMarks', 'mathsMarks', 'chemistryMarks', 'optionalSubject', 'optionalMarks', 'twelfthMaxMarks', 'twelfthAggregate', 'twelfthPercentage', 'twelfthAttempts',
            'diplomaUniversity', 'diplomaYear', 'diplomaRegisterNumber', 'diplomaFinalYearMaxMarks', 'diplomaFinalYearObtained', 'diplomaPercentage', 'diplomaAttempts',
            'cetScore', 'cetRank', 'cetYear', 'hasGap', 'gapReason'
          ]
        });
        if (academic) {
          const data = (academic.toJSON ? academic.toJSON() : JSON.parse(JSON.stringify(academic))) as any;
          // Apply legacy mappings for compatibility
          data.sslcSchool = data.tenthSchool;
          data.sslcBoard = data.tenthBoard;
          data.sslcYear = data.tenthPassingYear;
          data.sslcRegisterNumber = data.tenthRegisterNumber;
          data.sslcMarksObtained = data.tenthMarksObtained;
          data.sslcMaxMarks = data.tenthMaxMarks;
          data.sslcPercentage = data.tenthPercentage;
          data.sslcAttempts = data.tenthAttempts;

          data.pucSchool = data.twelfthSchool;
          data.pucBoard = data.twelfthBoard;
          data.pucYear = data.twelfthPassingYear;
          data.pucRegisterNumber = data.twelfthRegisterNumber;
          data.pucStream = data.twelfthStream;
          data.pucMaxMarks = data.twelfthMaxMarks;
          data.pucAggregate = data.twelfthAggregate;
          data.pucPercentage = data.twelfthPercentage;
          data.pucAttempts = data.twelfthAttempts;
          return data;
        }
        return null;
      }
      case 'documents': {
        const doc = await AdmissionDocument.findOne({
          where: { admissionId: admission.id },
          attributes: ['id', 'admissionId', 'photoUrl', 'signatureUrl', 'tenthMarksheetUrl', 'twelfthMarksheetUrl', 'diplomaSemester5MarksheetUrl', 'diplomaSemester6MarksheetUrl', 'cetScoreCardUrl', 'aadhaarUrl', 'casteCertificateUrl', 'domicileCertificateUrl', 'gapCertificateUrl', 'feesPaidReceiptUrl', 'admissionFormFeeReceiptUrl', 'admissionFormFeeUtr', 'admissionFormFeePaymentMode']
        });
        if (!doc) return null;
        // Sign R2 object keys into short-lived HTTPS URLs so the frontend <img> can load them
        const { getSignedUrlSync } = require('./r2.service');
        const urlFields = [
          'photoUrl', 'signatureUrl', 'tenthMarksheetUrl', 'twelfthMarksheetUrl',
          'diplomaSemester5MarksheetUrl', 'diplomaSemester6MarksheetUrl',
          'cetScoreCardUrl', 'aadhaarUrl', 'casteCertificateUrl', 'domicileCertificateUrl',
          'gapCertificateUrl', 'feesPaidReceiptUrl', 'admissionFormFeeReceiptUrl',
        ];
        const plain = doc.toJSON ? (doc.toJSON() as any) : JSON.parse(JSON.stringify(doc));
        for (const field of urlFields) {
          const val = plain[field];
          if (val && !val.startsWith('/uploads') && !val.startsWith('uploads/') && !val.startsWith('http')) {
            plain[field] = getSignedUrlSync(val);
          }
        }
        return plain;
      }
      default:
        throw new Error('Invalid step name');
    }
  }

  /** Returns step completion status for the StepIndicator component */
  async getStepStatus(userId: string): Promise<any> {
    const cacheKey = `admission:status:${userId}`;
    if (process.env.NODE_ENV !== 'development') {
      const cached = await redisService.getCache(cacheKey);
      if (cached) return cached;
    }

    const admission = await this.getOrCreate(userId);
    const full = await loadFullAdmission(admission);
    const result = computeStepStatus(full);

    if (process.env.NODE_ENV !== 'development') {
      await redisService.setCache(cacheKey, result, 300); // 5 mins TTL
    }
    return result;
  }

  /** Returns full details for Step 7 review & SubmittedView */
  async getFullDetails(userId: string): Promise<any> {
    const cacheKey = `admission:full:${userId}`;
    if (process.env.NODE_ENV !== 'development') {
      const cached = await redisService.getCache(cacheKey);
      if (cached) return cached;
    }

    const admission = await this.getOrCreate(userId);
    const full = await loadFullAdmission(admission);
    const result = serializeAdmission(full);

    // Sign R2 object keys so document previews render correctly in Step 7 review
    if (result.studentdocuments) {
      const { getSignedUrlSync } = require('./r2.service');
      const urlFields = [
        'photoUrl', 'signatureUrl', 'tenthMarksheetUrl', 'twelfthMarksheetUrl',
        'diplomaSemester5MarksheetUrl', 'diplomaSemester6MarksheetUrl',
        'cetScoreCardUrl', 'aadhaarUrl', 'casteCertificateUrl', 'domicileCertificateUrl',
        'gapCertificateUrl', 'feesPaidReceiptUrl', 'admissionFormFeeReceiptUrl',
      ];
      for (const field of urlFields) {
        const val = result.studentdocuments[field];
        if (val && !val.startsWith('/uploads') && !val.startsWith('uploads/') && !val.startsWith('http')) {
          result.studentdocuments[field] = getSignedUrlSync(val);
        }
      }
    }

    if (process.env.NODE_ENV !== 'development') {
      await redisService.setCache(cacheKey, result, 300); // 5 mins TTL
    }
    return result;
  }

  // ── Step 1: Admission Details ─────────────────────────────────────────────

  async saveStep1(userId: string, payload: {
    admissionType: string;
    branchId: string | number;
    aadhaar: string;
    cetNumber?: string;
    dcetNumber?: string;
    qualification?: 'PUC' | 'DIPLOMA';
  }): Promise<string> {
    const admission = await this.getOrCreate(userId);
    this.checkEditable(admission, 'admission');
    let applicationNumber = admission.applicationNumber;
    if (!applicationNumber) {
      const config = await SystemConfiguration.findOne();
      const currentAcademicYear = admission.academicYear || config?.admissionCycle || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      applicationNumber = await generateAdmissionNumber(currentAcademicYear, payload.branchId);
    }

    await admission.update({
      applicationNumber,
      admissionType: payload.admissionType,
      branchId: payload.branchId ? String(payload.branchId) : null,
      aadhaar: payload.aadhaar,
      cetNumber: payload.cetNumber || null,
      dcetNumber: payload.dcetNumber || null,
      qualification: payload.qualification || null,
    });
    await this.markSectionCorrected(admission, 'admission');
    await this.invalidateCache(userId);
    return admission.id;
  }

  // ── Step 2: Personal Details ──────────────────────────────────────────────

  async saveStep2(userId: string, payload: Record<string, any>): Promise<string> {
    const admission = await this.getOrCreate(userId);
    this.checkEditable(admission, 'personal');
    
    const allowedFields = Object.keys(AdmissionPersonalDetail.rawAttributes).filter(
      (key) => !['id', 'admissionId', 'createdAt', 'updatedAt'].includes(key)
    );
    const filteredPayload: Record<string, any> = {};
    for (const key of allowedFields) {
      if (payload[key] !== undefined) {
        filteredPayload[key] = payload[key];
      }
    }

    const existing = await AdmissionPersonalDetail.findOne({ where: { admissionId: admission.id } });
    if (existing) {
      await existing.update(filteredPayload);
    } else {
      await AdmissionPersonalDetail.create({ admissionId: admission.id, ...filteredPayload });
    }
    await this.markSectionCorrected(admission, 'personal');
    await this.invalidateCache(userId);
    return admission.id;
  }

  // ── Step 3: Parent Details ────────────────────────────────────────────────

  async saveStep3(userId: string, payload: Record<string, any>): Promise<string> {
    const admission = await this.getOrCreate(userId);
    this.checkEditable(admission, 'parent');
    
    const allowedFields = Object.keys(AdmissionParentDetail.rawAttributes).filter(
      (key) => !['id', 'admissionId', 'createdAt', 'updatedAt'].includes(key)
    );
    const filteredPayload: Record<string, any> = {};
    for (const key of allowedFields) {
      if (payload[key] !== undefined) {
        filteredPayload[key] = payload[key];
      }
    }

    const existing = await AdmissionParentDetail.findOne({ where: { admissionId: admission.id } });
    if (existing) {
      await existing.update(filteredPayload);
    } else {
      await AdmissionParentDetail.create({ admissionId: admission.id, ...filteredPayload });
    }
    await this.markSectionCorrected(admission, 'parent');
    await this.invalidateCache(userId);
    return admission.id;
  }

  // ── Step 4: Address ───────────────────────────────────────────────────────

  async saveStep4(userId: string, payload: Record<string, any>): Promise<string> {
    const admission = await this.getOrCreate(userId);
    this.checkEditable(admission, 'address');
    
    const allowedFields = Object.keys(AdmissionAddress.rawAttributes).filter(
      (key) => !['id', 'admissionId', 'createdAt', 'updatedAt'].includes(key)
    );
    const filteredPayload: Record<string, any> = {};
    for (const key of allowedFields) {
      if (payload[key] !== undefined) {
        filteredPayload[key] = payload[key];
      }
    }

    const existing = await AdmissionAddress.findOne({ where: { admissionId: admission.id } });
    if (existing) {
      await existing.update(filteredPayload);
    } else {
      await AdmissionAddress.create({ admissionId: admission.id, ...filteredPayload });
    }
    await this.markSectionCorrected(admission, 'address');
    await this.invalidateCache(userId);
    return admission.id;
  }

  // ── Step 5: Academic Details ──────────────────────────────────────────────

  async saveStep5(userId: string, payload: Record<string, any>): Promise<string> {
    const admission = await this.getOrCreate(userId);
    this.checkEditable(admission, 'academic');
    const existing = await AdmissionAcademicDetail.findOne({ where: { admissionId: admission.id } });
    
    const q = (admission.qualification || '').toUpperCase();
    const showPUC = q === 'PUC' || (!q && (admission.admissionType === 'KCET' || admission.admissionType === 'COMEDK'));
    const showDiploma = q === 'DIPLOMA' || (!q && admission.admissionType === 'DCET');

    const dbPayload = {
      tenthSchool: payload.sslcSchool,
      tenthBoard: payload.sslcBoard,
      tenthPassingYear: payload.sslcYear,
      tenthRegisterNumber: payload.sslcRegisterNumber,
      tenthMarksObtained: payload.sslcMarksObtained,
      tenthMaxMarks: payload.sslcMaxMarks,
      tenthPercentage: payload.sslcPercentage,
      tenthAttempts: payload.sslcAttempts || 1,
      tenthSubjectMarks: payload.sslcSubjectMarks || null,
      
      twelfthSchool: showPUC ? payload.pucSchool || null : null,
      twelfthBoard: showPUC ? payload.pucBoard || null : null,
      twelfthPassingYear: showPUC ? (payload.pucYear || null) : null,
      twelfthRegisterNumber: showPUC ? payload.pucRegisterNumber || null : null,
      twelfthStream: showPUC ? payload.pucStream || 'SCIENCE' : null,
      physicsMarks: showPUC ? payload.physicsMarks || null : null,
      mathsMarks: showPUC ? payload.mathsMarks || null : null,
      chemistryMarks: showPUC ? payload.chemistryMarks || null : null,
      optionalSubject: showPUC ? payload.optionalSubject || null : null,
      optionalMarks: showPUC ? payload.optionalMarks || null : null,
      twelfthMaxMarks: showPUC ? payload.pucMaxMarks || null : null,
      twelfthAggregate: showPUC ? payload.pucAggregate || null : null,
      twelfthPercentage: showPUC ? payload.pucPercentage || null : null,
      twelfthAttempts: showPUC ? payload.pucAttempts || 1 : null,
      
      diplomaUniversity: showDiploma ? payload.diplomaUniversity || null : null,
      diplomaYear: showDiploma ? (payload.diplomaYear || null) : null,
      diplomaRegisterNumber: showDiploma ? payload.diplomaRegisterNumber || null : null,
      diplomaFinalYearMaxMarks: showDiploma ? payload.diplomaFinalYearMaxMarks || null : null,
      diplomaFinalYearObtained: showDiploma ? payload.diplomaFinalYearObtained || null : null,
      diplomaPercentage: showDiploma ? payload.diplomaPercentage || null : null,
      diplomaAttempts: showDiploma ? payload.diplomaAttempts || 1 : null,
      
      cetScore: payload.cetScore,
      cetRank: payload.cetRank,
      cetYear: payload.cetYear,
      hasGap: payload.hasGap,
      gapReason: payload.gapReason,
    };

    if (existing) {
      await existing.update(dbPayload);
    } else {
      await AdmissionAcademicDetail.create({ admissionId: admission.id, ...dbPayload });
    }
    await this.markSectionCorrected(admission, 'academic');
    await this.invalidateCache(userId);
    return admission.id;
  }

  // ── Step 6: Documents ─────────────────────────────────────────────────────

  async saveStep6(userId: string, fileUrls: Record<string, any>): Promise<string> {
    const admission = await this.getOrCreate(userId);
    this.checkEditable(admission, 'documents');
    const existing = await AdmissionDocument.findOne({ where: { admissionId: admission.id } });
    
    const filesToCleanup: string[] = [];
    if (existing) {
      for (const [key, newVal] of Object.entries(fileUrls)) {
        if (key.endsWith('Url')) {
          const oldVal = (existing as any)[key];
          if (oldVal && oldVal !== newVal) {
            filesToCleanup.push(oldVal);
          }
        }
      }
      await existing.update(fileUrls);
    } else {
      await AdmissionDocument.create({ admissionId: admission.id, ...fileUrls });
    }

    // Safely delete unreferenced files from disk
    for (const relativePath of filesToCleanup) {
      try {
        const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
        const fullPath = path.join(process.cwd(), cleanPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {
        // Ignore unlinking errors (e.g. file already deleted)
      }
    }

    await this.markSectionCorrected(admission, 'documents');
    await this.invalidateCache(userId);
    return admission.id;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async submitApplication(userId: string): Promise<string> {
    const transaction = await db.transaction();
    try {
      // Resolve active admission by userId + status=DRAFT (DRAFT/CORRECTION_REQUIRED)
      const admission = await Admission.findOne({
        where: {
          userId,
          applicationStatus: { [Op.in]: ['DRAFT', 'CORRECTION_REQUIRED'] }
        },
        lock: true,
        transaction,
      });
      if (!admission) {
        throw new Error('Application not found or already submitted.');
      }
      if (admission.applicationStatus !== 'DRAFT' && admission.applicationStatus !== 'CORRECTION_REQUIRED') {
        throw new Error('Application cannot be submitted at this stage.');
      }
      const isResubmission = admission.applicationStatus === 'CORRECTION_REQUIRED';
      const newStatus = isResubmission ? 'RESUBMITTED' : 'SUBMITTED';
      await admission.update({
        applicationStatus: newStatus,
        submittedAt: isResubmission ? (admission.submittedAt || new Date()) : new Date(),
        resubmittedAt: isResubmission ? new Date() : (admission.resubmittedAt || null),
        documentsVerified: false,
        feesVerified: false,
        eligibilityVerified: false,
        verificationRemarks: null,
      }, { transaction });
      await transaction.commit();
      await this.invalidateCache(userId);
      return admission.id;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ── Uniqueness Checks ─────────────────────────────────────────────────────

  async checkAadhaar(aadhaar: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { aadhaar };
    if (excludeUserId) {
      const self = await Admission.findOne({ where: { userId: excludeUserId } });
      if (self) where.id = { [Op.ne]: self.id };
    }
    const count = await Admission.count({ where });
    return count > 0;
  }

  async checkCet(cetNumber: string, type: string, excludeUserId?: string): Promise<boolean> {
    const field = type === 'DCET' ? 'dcetNumber' : 'cetNumber';
    const where: any = { [field]: cetNumber };
    if (excludeUserId) {
      const self = await Admission.findOne({ where: { userId: excludeUserId } });
      if (self) where.id = { [Op.ne]: self.id };
    }
    const count = await Admission.count({ where });
    return count > 0;
  }

  // ── Branches / Departments ────────────────────────────────────────────────

  async getBranches(): Promise<Department[]> {
    return Department.findAll({
      where: {
        code: { [Op.ne]: 'AS' },
        type: { [Op.ne]: 'SEMESTER_HANDLING' },
      },
      order: [['name', 'ASC']]
    });
  }

  async getAvailableBatches(): Promise<string[]> {
    try {
      const studentRows = await Student.findAll({
        attributes: [
          [Sequelize.fn('DISTINCT', Sequelize.col('batchYear')), 'batchYear'],
          'admissionBatch',
        ],
        raw: true,
      });

      const batchSet = new Set<string>();

      studentRows.forEach((s: any) => {
        if (s.admissionBatch) {
          batchSet.add(formatBatchCohort(s.admissionBatch));
        }
        if (s.batchYear) {
          batchSet.add(formatBatchCohort(s.batchYear));
        }
      });

      try {
        const admissionRows = await Admission.findAll({
          attributes: [
            [Sequelize.fn('DISTINCT', Sequelize.col('academicYear')), 'academicYear'],
          ],
          raw: true,
        });
        admissionRows.forEach((a: any) => {
          if (a.academicYear) {
            batchSet.add(formatBatchCohort(a.academicYear));
          }
        });
      } catch {}

      // Include standard 4-year engineering cohorts around current year
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 4; y <= currentYear + 2; y++) {
        batchSet.add(`${y}–${y + 4}`);
      }

      const sortedBatches = Array.from(batchSet).filter(Boolean).sort((a, b) => {
        const yearA = parseInt(a.slice(0, 4), 10) || 0;
        const yearB = parseInt(b.slice(0, 4), 10) || 0;
        return yearB - yearA;
      });

      return sortedBatches;
    } catch {
      const currentYear = new Date().getFullYear();
      const defaults: string[] = [];
      for (let y = currentYear + 2; y >= currentYear - 4; y--) {
        defaults.push(`${y}–${y + 4}`);
      }
      return defaults;
    }
  }

  // ── Admin: List all applications ──────────────────────────────────────────

  async listApplications(filters: {
    status?: string;
    branchId?: string;
    semester?: string;
    admissionType?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
    qualification?: string;
    gender?: string;
    category?: string;
    district?: string;
    academicYear?: string;
    batch?: string;
    startDate?: string;
    endDate?: string;
    includeFullDetails?: boolean;
  }) {
    const {
      status,
      branchId,
      semester,
      admissionType,
      search,
      sortBy,
      sortOrder = 'DESC',
      page = 1,
      limit = 20,
      qualification,
      gender,
      category,
      district,
      academicYear,
      batch,
      startDate,
      endDate,
      includeFullDetails = false,
    } = filters;
    const offset = (page - 1) * limit;

    // Helper serializer for Student master records (e.g. Pre-ERP onboarded students)
    const serializeStudentMasterRecord = (studentRow: any) => {
      const plainStudent = studentRow.toJSON ? studentRow.toJSON() : studentRow;
      const admission = plainStudent.admission;
      const user = plainStudent.user;
      const dept = plainStudent.department;
      const studentUsn = (plainStudent.usn || admission?.usn || null);

      if (admission) {
        const serialized = serializeAdmission(admission);
        serialized.usn = studentUsn;
        serialized.branch = dept || serialized.branch;
        serialized.branchId = plainStudent.departmentId || serialized.branchId;
        serialized.user = {
          ...(serialized.user || user),
          student: {
            id: plainStudent.id,
            usn: studentUsn,
            enrollmentNumber: studentUsn || plainStudent.enrollmentNumber || admission.applicationNumber,
            rollNumber: plainStudent.rollNumber,
            semester: plainStudent.semester,
          }
        };
        return serialized;
      }

      // Pre-ERP existing onboarded student record (No Admission row, application_number = NULL)
      return {
        id: plainStudent.id,
        userId: plainStudent.userId,
        applicationNumber: null,
        usn: studentUsn,
        academicYear: plainStudent.currentAcademicYear || '2026-2027',
        admissionType: plainStudent.admissionType || 'EXISTING',
        branchId: plainStudent.departmentId,
        branch: dept ? { id: dept.id, name: dept.name, code: dept.code } : null,
        entrySemester: plainStudent.initialSemester || 1,
        qualification: null,
        aadhaar: null,
        cetNumber: null,
        dcetNumber: null,
        applicationStatus: 'ENROLLED',
        submittedAt: plainStudent.createdAt,
        reviewedAt: plainStudent.createdAt,
        verifiedAt: plainStudent.createdAt,
        enrolledAt: plainStudent.createdAt,
        createdAt: plainStudent.createdAt,
        updatedAt: plainStudent.updatedAt,
        documentsVerified: true,
        feesVerified: true,
        eligibilityVerified: true,
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone || null,
          profileImage: user.profileImage,
          student: {
            id: plainStudent.id,
            usn: studentUsn,
            enrollmentNumber: studentUsn || plainStudent.enrollmentNumber,
            rollNumber: plainStudent.rollNumber,
            semester: plainStudent.semester,
          }
        } : null,
        studentpersonaldetails: {
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          middleName: null,
          dateOfBirth: plainStudent.dateOfBirth ? (typeof plainStudent.dateOfBirth === 'string' ? plainStudent.dateOfBirth : plainStudent.dateOfBirth.toISOString().split('T')[0]) : null,
          gender: plainStudent.gender || null,
          category: null,
          religion: null,
          phone: user?.phone || null,
          email: user?.email || null,
          nationality: 'Indian',
        },
        studentparentdetails: {
          fatherName: plainStudent.fatherName || null,
          motherName: plainStudent.motherName || null,
          fatherPhone: plainStudent.parentPhone || null,
          fatherEmail: plainStudent.parentEmail || null,
          parentPhone: plainStudent.parentPhone || null,
        },
        studentaddress: {
          currentAddressLine1: plainStudent.address || null,
          currentCity: null,
          currentState: null,
          currentPincode: null,
        },
        studentacademicdetails: null,
        studentdocuments: null,
        documents: null,
        timeline: {
          submittedAt: plainStudent.createdAt,
          enrolledAt: plainStudent.createdAt,
          usnAssignedAt: plainStudent.createdAt,
        }
      };
    };

    // ── CASE 1: Student Management Tab (status === 'ENROLLED') ──
    // Fetches all approved enrolled students (both ERP enrolled and pre-ERP onboarded) directly from Student master table
    if (status === 'ENROLLED') {
      const studentWhere: any = {
        admissionStatus: 'APPROVED',
      };

      if (branchId && branchId !== 'ALL') {
        studentWhere.departmentId = branchId;
      }

      if (semester && semester !== 'ALL') {
        const semNum = parseInt(semester, 10);
        if (!isNaN(semNum)) {
          studentWhere.semester = semNum;
        }
      }

      if (admissionType && admissionType !== 'ALL') {
        studentWhere.admissionType = admissionType;
      }

      if (gender && gender !== 'ALL') {
        studentWhere.gender = gender;
      }

      if (district && district.trim() !== '') {
        studentWhere.address = { [Op.iLike]: `%${district.trim()}%` };
      }

      if (academicYear && academicYear !== 'ALL') {
        const ayMatch = String(academicYear).match(/(\d{4})/);
        if (ayMatch) {
          const startYear = parseInt(ayMatch[1], 10);
          const nextYear = startYear + 1;
          const ayConditions: any[] = [
            { currentAcademicYear: academicYear },
            { currentAcademicYear: `${startYear}-${nextYear}` },
            { currentAcademicYear: `${startYear}–${nextYear}` },
            { currentAcademicYear: { [Op.iLike]: `%${startYear}%` } }
          ];
          if (studentWhere[Op.and]) {
            studentWhere[Op.and].push({ [Op.or]: ayConditions });
          } else {
            studentWhere[Op.and] = [{ [Op.or]: ayConditions }];
          }
        } else {
          studentWhere.currentAcademicYear = academicYear;
        }
      }

      if (batch && batch !== 'ALL') {
        const bMatch = String(batch).match(/(\d{4})/);
        if (bMatch) {
          const bYear = parseInt(bMatch[1], 10);
          const rangeMatch = String(batch).match(/(\d{4})[-–](\d{4})/);
          const endYear = rangeMatch ? parseInt(rangeMatch[2], 10) : bYear + 4;

          const batchConditions: any[] = [
            { batchYear: bYear },
            { admissionBatch: { [Op.iLike]: `%${bYear}%` } },
            { currentAcademicYear: { [Op.iLike]: `%${bYear}%` } },
            { enrollmentNumber: { [Op.iLike]: `%${bYear}%` } },
            { usn: { [Op.iLike]: `%${bYear}%` } }
          ];

          if (rangeMatch) {
            batchConditions.push(
              { admissionBatch: { [Op.iLike]: `%${bYear}–${endYear}%` } },
              { admissionBatch: { [Op.iLike]: `%${bYear}-${endYear}%` } }
            );
          }

          if (studentWhere[Op.and]) {
            studentWhere[Op.and].push({ [Op.or]: batchConditions });
          } else {
            studentWhere[Op.and] = [{ [Op.or]: batchConditions }];
          }
        }
      }

      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date('2020-01-01');
        const end = endDate ? new Date(endDate) : new Date();
        studentWhere.createdAt = { [Op.between]: [start, end] };
      }

      if (search && search.trim() !== '') {
        const s = search.trim();
        const tokens = s.split(/\s+/).filter(Boolean);

        const searchOr: any[] = [
          { usn: { [Op.iLike]: `%${s}%` } },
          { enrollmentNumber: { [Op.iLike]: `%${s}%` } },
          { rollNumber: { [Op.iLike]: `%${s}%` } },
          { '$user.firstName$': { [Op.iLike]: `%${s}%` } },
          { '$user.lastName$': { [Op.iLike]: `%${s}%` } },
          { '$user.email$': { [Op.iLike]: `%${s}%` } },
          { '$user.phone$': { [Op.iLike]: `%${s}%` } },
          { fatherName: { [Op.iLike]: `%${s}%` } },
          { motherName: { [Op.iLike]: `%${s}%` } },
          { parentPhone: { [Op.iLike]: `%${s}%` } },
          { address: { [Op.iLike]: `%${s}%` } },
          Sequelize.where(
            Sequelize.fn('concat', Sequelize.col('user.firstName'), ' ', Sequelize.col('user.lastName')),
            { [Op.iLike]: `%${s}%` }
          ),
        ];

        if (tokens.length > 1) {
          searchOr.push({
            [Op.and]: tokens.map((token) => ({
              [Op.or]: [
                { '$user.firstName$': { [Op.iLike]: `%${token}%` } },
                { '$user.lastName$': { [Op.iLike]: `%${token}%` } },
                { usn: { [Op.iLike]: `%${token}%` } },
                { enrollmentNumber: { [Op.iLike]: `%${token}%` } },
                { '$user.email$': { [Op.iLike]: `%${token}%` } },
                { '$user.phone$': { [Op.iLike]: `%${token}%` } },
              ]
            }))
          });
        }

        if (studentWhere[Op.and]) {
          studentWhere[Op.and].push({ [Op.or]: searchOr });
        } else {
          studentWhere[Op.or] = searchOr;
        }
      }

      let order: any[] = [['createdAt', 'DESC']];
      if (sortBy === 'date') {
        order = [['createdAt', sortOrder]];
      } else if (sortBy === 'rank') {
        order = [['usn', sortOrder]];
      } else if (sortBy === 'updatedAt') {
        order = [['updatedAt', sortOrder]];
      } else if (sortBy === 'name') {
        order = [[{ model: User, as: 'user' }, 'firstName', sortOrder]];
      }

      try {
        const { count, rows } = await Student.findAndCountAll({
          where: studentWhere,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'profileImage'],
              required: false,
            },
            {
              model: Department,
              as: 'department',
              required: false,
            },
            {
              model: Admission,
              as: 'admission',
              required: false,
              include: [
                { model: AdmissionPersonalDetail, as: 'studentpersonaldetails', required: false },
                { model: AdmissionAddress, as: 'studentaddress', required: false },
                { model: AdmissionParentDetail, as: 'studentparentdetails', required: false },
                { model: AdmissionAcademicDetail, as: 'studentacademicdetails', required: false },
                { model: AdmissionDocument, as: 'studentdocuments', required: false },
                { model: User, as: 'verifiedByAdmin', attributes: ['id', 'firstName', 'lastName', 'email', 'username'], required: false },
                { model: User, as: 'approvedByAdmin', attributes: ['id', 'firstName', 'lastName', 'email', 'username'], required: false },
              ]
            }
          ],
          order,
          limit,
          offset,
          distinct: true,
        });

        return {
          total: count,
          page,
          totalPages: Math.ceil(count / limit) || 1,
          applications: rows.map(serializeStudentMasterRecord),
        };
      } catch (dbErr: any) {
        fs.writeFileSync(path.join(process.cwd(), 'error_log.txt'), dbErr.stack || String(dbErr));
        throw dbErr;
      }
    }

    // ── CASE 2: Other Admission Queue Statuses & ALL ──
    const where: any = {};
    if (status && status !== 'ALL' && status !== 'HISTORY') {
      if (status === 'QUEUE') {
        where.applicationStatus = { [Op.in]: ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'] };
      } else if (status === 'RESUBMITTED') {
        where.applicationStatus = 'RESUBMITTED';
      } else if (status === 'SUBMITTED') {
        where.applicationStatus = 'SUBMITTED';
        where.resubmittedAt = null;
        where.rejectionReason = null;
        where.rejectionReasonCode = null;
      } else if (status === 'APPROVED') {
        where.applicationStatus = { [Op.in]: ['APPROVED', 'PRINCIPAL_APPROVED'] };
      } else {
        where.applicationStatus = status;
      }
    } else {
      where.applicationStatus = { [Op.ne]: 'DRAFT' };
    }
    if (branchId && branchId !== 'ALL') where.branchId = branchId;
    if (admissionType && admissionType !== 'ALL') where.admissionType = admissionType;
    if (qualification && qualification !== 'ALL') where.qualification = qualification;

    // Filter by Semester
    if (semester && semester !== 'ALL') {
      const semNum = parseInt(semester);
      if (semNum === 3) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [
            { entrySemester: 3 },
            { qualification: 'DIPLOMA' },
            { admissionType: 'DCET' },
            { applicationType: 'LATERAL_ENTRY' },
            { '$user.student.semester$': 3 }
          ]
        });
      } else if (semNum === 1) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [
            { entrySemester: 1 },
            { '$user.student.semester$': 1 },
            {
              [Op.and]: [
                { entrySemester: { [Op.or]: [1, null] } },
                { qualification: { [Op.or]: [{ [Op.ne]: 'DIPLOMA' }, { [Op.eq]: null }] } },
                { admissionType: { [Op.or]: [{ [Op.ne]: 'DCET' }, { [Op.eq]: null }] } },
                { applicationType: { [Op.or]: [{ [Op.ne]: 'LATERAL_ENTRY' }, { [Op.eq]: null }] } },
              ]
            }
          ]
        });
      } else if (!isNaN(semNum)) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [
            { entrySemester: semNum },
            { '$user.student.semester$': semNum }
          ]
        });
      }
    }

    // Academic Year filter
    if (academicYear && academicYear !== 'ALL') {
      const startYearMatch = academicYear.match(/\d{4}/);
      if (startYearMatch) {
        const startYear = parseInt(startYearMatch[0]);
        const start = new Date(`${startYear}-06-01T00:00:00.000Z`);
        const end = new Date(`${startYear + 1}-05-31T23:59:59.999Z`);
        where.createdAt = { [Op.between]: [start, end] };
      }
    }

    // Batch filter
    if (batch && batch !== 'ALL') {
      const bMatch = String(batch).match(/(\d{4})/);
      if (bMatch) {
        const bYear = parseInt(bMatch[1], 10);
        const rangeMatch = String(batch).match(/(\d{4})[-–](\d{4})/);
        const endYear = rangeMatch ? parseInt(rangeMatch[2], 10) : bYear + 4;

        const batchConditions: any[] = [
          { '$user.student.batchYear$': bYear },
          { '$user.student.admissionBatch$': { [Op.iLike]: `%${bYear}%` } },
          { '$user.student.currentAcademicYear$': { [Op.iLike]: `%${bYear}%` } },
          { '$user.student.enrollmentNumber$': { [Op.iLike]: `%${bYear}%` } },
          { '$user.student.usn$': { [Op.iLike]: `%${bYear}%` } },
          { academicYear: { [Op.iLike]: `%${bYear}%` } },
          { applicationNumber: { [Op.iLike]: `%${bYear}%` } },
          { usn: { [Op.iLike]: `%${bYear}%` } }
        ];

        if (rangeMatch) {
          batchConditions.push(
            { '$user.student.admissionBatch$': { [Op.iLike]: `%${bYear}–${endYear}%` } },
            { '$user.student.admissionBatch$': { [Op.iLike]: `%${bYear}-${endYear}%` } }
          );
        }

        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({ [Op.or]: batchConditions });
      }
    }

    // Date range filter
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date('2020-01-01');
      const end = endDate ? new Date(endDate) : new Date();
      if (where.createdAt) {
        where.createdAt = {
          [Op.and]: [
            where.createdAt,
            { [Op.between]: [start, end] }
          ]
        };
      } else {
        where.createdAt = { [Op.between]: [start, end] };
      }
    }

    // Universal Search filter
    if (search && search.trim() !== '') {
      const s = search.trim();
      const tokens = s.split(/\s+/).filter(Boolean);

      const searchOrConditions: any[] = [
        { applicationNumber: { [Op.iLike]: `%${s}%` } },
        { aadhaar: { [Op.iLike]: `%${s}%` } },
        { '$user.firstName$': { [Op.iLike]: `%${s}%` } },
        { '$user.lastName$': { [Op.iLike]: `%${s}%` } },
        { '$user.email$': { [Op.iLike]: `%${s}%` } },
        { '$user.phone$': { [Op.iLike]: `%${s}%` } },
        { '$user.student.enrollmentNumber$': { [Op.iLike]: `%${s}%` } },
        { '$user.student.usn$': { [Op.iLike]: `%${s}%` } },
        { '$studentpersonaldetails.firstName$': { [Op.iLike]: `%${s}%` } },
        { '$studentpersonaldetails.middleName$': { [Op.iLike]: `%${s}%` } },
        { '$studentpersonaldetails.lastName$': { [Op.iLike]: `%${s}%` } },
        Sequelize.where(
          Sequelize.fn('concat', Sequelize.col('user.firstName'), ' ', Sequelize.col('user.lastName')),
          { [Op.iLike]: `%${s}%` }
        ),
        Sequelize.where(
          Sequelize.fn('concat', Sequelize.col('studentpersonaldetails.firstName'), ' ', Sequelize.fn('coalesce', Sequelize.col('studentpersonaldetails.middleName'), ''), ' ', Sequelize.col('studentpersonaldetails.lastName')),
          { [Op.iLike]: `%${s}%` }
        ),
        Sequelize.where(
          Sequelize.fn('concat', Sequelize.col('studentpersonaldetails.firstName'), ' ', Sequelize.col('studentpersonaldetails.lastName')),
          { [Op.iLike]: `%${s}%` }
        ),
      ];

      if (tokens.length > 1) {
        searchOrConditions.push({
          [Op.and]: tokens.map(token => ({
            [Op.or]: [
              { '$user.firstName$': { [Op.iLike]: `%${token}%` } },
              { '$user.lastName$': { [Op.iLike]: `%${token}%` } },
              { '$studentpersonaldetails.firstName$': { [Op.iLike]: `%${token}%` } },
              { '$studentpersonaldetails.middleName$': { [Op.iLike]: `%${token}%` } },
              { '$studentpersonaldetails.lastName$': { [Op.iLike]: `%${token}%` } },
              { applicationNumber: { [Op.iLike]: `%${token}%` } },
              { aadhaar: { [Op.iLike]: `%${token}%` } },
              { '$user.email$': { [Op.iLike]: `%${token}%` } },
              { '$user.phone$': { [Op.iLike]: `%${token}%` } },
            ]
          }))
        });
      }

      where[Op.or] = searchOrConditions;
    }

    // Filters for personal details
    const personalWhere: any = {};
    if (gender && gender !== 'ALL') personalWhere.gender = gender;
    if (category && category !== 'ALL') personalWhere.category = category;

    // Filters for address
    const addressWhere: any = {};
    if (district && district.trim() !== '') {
      addressWhere.currentCity = { [Op.iLike]: `%${district.trim()}%` };
    }

    const include: any[] = [
      {
        model: User,
        as: 'user',
        required: false,
        attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'profileImage'],
        include: [
          { model: Student, as: 'student', attributes: ['id', 'usn', 'enrollmentNumber', 'rollNumber', 'semester', 'batchYear', 'admissionBatch', 'currentAcademicYear'], required: false }
        ]
      },
      { model: Department, as: 'branch', required: false },
      { model: User, as: 'verifiedByAdmin', attributes: ['id', 'firstName', 'lastName', 'email', 'username'], required: false },
      { model: User, as: 'correctionRequestedBy', attributes: ['id', 'firstName', 'lastName', 'email', 'username'], required: false },
      { model: User, as: 'rejectedByAdmin', attributes: ['id', 'firstName', 'lastName', 'email', 'username'], required: false },
      { model: User, as: 'approvedByAdmin', attributes: ['id', 'firstName', 'lastName', 'email', 'username'], required: false },
      {
        model: AdmissionPersonalDetail,
        as: 'studentpersonaldetails',
        required: Object.keys(personalWhere).length > 0,
        where: Object.keys(personalWhere).length > 0 ? personalWhere : undefined
      },
      {
        model: AdmissionAddress,
        as: 'studentaddress',
        required: Object.keys(addressWhere).length > 0,
        where: Object.keys(addressWhere).length > 0 ? addressWhere : undefined
      },
      {
        model: AdmissionDocument,
        as: 'studentdocuments',
        required: false
      }
    ];

    if (includeFullDetails) {
      include.push({ model: AdmissionParentDetail, as: 'studentparentdetails', required: false });
      include.push({ model: AdmissionAcademicDetail, as: 'studentacademicdetails', required: false });
    }

    let order: any[] = [['createdAt', 'DESC']];
    if (sortBy === 'date') {
      order = [['createdAt', sortOrder]];
    } else if (sortBy === 'rank') {
      order = [['applicationNumber', sortOrder]];
    } else if (sortBy === 'updatedAt') {
      order = [['updatedAt', sortOrder]];
    } else if (sortBy === 'name') {
      order = [[{ model: User, as: 'user' }, 'firstName', sortOrder]];
    }

    try {
      const { count, rows } = await Admission.findAndCountAll({
        where,
        include,
        order,
        limit,
        offset,
        distinct: true,
      });

      // Ensure USN is present on each application row if student has it
      let finalRows = rows.map((r: any) => {
        const item = r.toJSON ? r.toJSON() : r;
        if (!item.usn && item.user?.student?.usn) {
          item.usn = item.user.student.usn;
        }
        return item;
      });
      let finalCount = count;

      if (status === 'ALL') {
        const studentWhere: any = {
          admissionType: 'EXISTING',
        };
        if (branchId && branchId !== 'ALL') studentWhere.departmentId = branchId;
        if (semester && semester !== 'ALL') {
          const semNum = parseInt(semester, 10);
          if (!isNaN(semNum)) studentWhere.semester = semNum;
        }
        if (gender && gender !== 'ALL') studentWhere.gender = gender;
        if (district && district.trim() !== '') studentWhere.address = { [Op.iLike]: `%${district.trim()}%` };

        const existingStudents = await Student.findAll({
          where: studentWhere,
          include: [
            { model: User, as: 'user', required: false },
            { model: Department, as: 'department', required: false }
          ],
        });

        if (existingStudents.length > 0) {
          const serializedExisting = existingStudents.map(serializeStudentMasterRecord);
          finalRows = [...rows, ...serializedExisting];
          finalCount = count + existingStudents.length;
        }
      }

      return {
        total: finalCount,
        page,
        totalPages: Math.ceil(finalCount / limit) || 1,
        applications: finalRows,
      };
    } catch (dbErr: any) {
      fs.writeFileSync(path.join(process.cwd(), 'error_log.txt'), dbErr.stack || String(dbErr));
      throw dbErr;
    }
  }

  /** Admin: get single full application */
  async getApplicationById(id: string): Promise<any> {
    // 1. Check Admission by PK
    const full = await Admission.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'profileImage'],
          include: [
            { model: Student, as: 'student', attributes: ['id', 'usn', 'enrollmentNumber', 'rollNumber', 'semester', 'scheme', 'gender', 'previousCollege'] }
          ]
        },
        { model: Department, as: 'branch' },
        { model: User, as: 'verifiedByAdmin', attributes: ['id', 'firstName', 'lastName', 'email', 'username'] },
        { model: User, as: 'correctionRequestedBy', attributes: ['id', 'firstName', 'lastName', 'email', 'username'] },
        { model: User, as: 'rejectedByAdmin', attributes: ['id', 'firstName', 'lastName', 'email', 'username'] },
        { model: User, as: 'approvedByAdmin', attributes: ['id', 'firstName', 'lastName', 'email', 'username'] },
        { model: AdmissionPersonalDetail, as: 'studentpersonaldetails' },
        { model: AdmissionParentDetail, as: 'studentparentdetails' },
        { model: AdmissionAddress, as: 'studentaddress' },
        { model: AdmissionAcademicDetail, as: 'studentacademicdetails' },
        { model: AdmissionDocument, as: 'studentdocuments' },
      ],
    });

    if (full) {
      return serializeAdmission(full);
    }

    // 2. Check Student table (Pre-ERP existing onboarded student)
    const student = await Student.findOne({
      where: {
        [Op.or]: [
          { id },
          { userId: id }
        ]
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'profileImage']
        },
        {
          model: Department,
          as: 'department'
        }
      ]
    });

    if (!student) return null;

    const user = student.user;
    const dept = student.department;

    return {
      id: student.id,
      userId: student.userId,
      applicationNumber: null,
      academicYear: student.currentAcademicYear || '2026-2027',
      admissionType: student.admissionType || 'EXISTING',
      branchId: student.departmentId,
      branch: dept ? { id: dept.id, name: dept.name, code: dept.code } : null,
      entrySemester: student.initialSemester || 1,
      qualification: null,
      aadhaar: null,
      cetNumber: null,
      dcetNumber: null,
      applicationStatus: 'ENROLLED',
      submittedAt: student.createdAt,
      reviewedAt: student.createdAt,
      verifiedAt: student.createdAt,
      enrolledAt: student.createdAt,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      documentsVerified: true,
      feesVerified: true,
      eligibilityVerified: true,
      user: user ? {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || null,
        profileImage: user.profileImage,
        student: {
          id: student.id,
          enrollmentNumber: student.enrollmentNumber || student.usn,
          rollNumber: student.rollNumber,
          semester: student.semester,
        }
      } : null,
      studentpersonaldetails: {
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        middleName: null,
        dateOfBirth: student.dateOfBirth ? (typeof student.dateOfBirth === 'string' ? student.dateOfBirth : student.dateOfBirth.toISOString().split('T')[0]) : null,
        gender: student.gender || null,
        category: null,
        religion: null,
        phone: user?.phone || null,
        email: user?.email || null,
        nationality: 'Indian',
      },
      studentparentdetails: {
        fatherName: student.fatherName || null,
        motherName: student.motherName || null,
        fatherPhone: student.parentPhone || null,
        fatherEmail: student.parentEmail || null,
        parentPhone: student.parentPhone || null,
      },
      studentaddress: {
        currentAddressLine1: student.address || null,
        currentCity: null,
        currentState: null,
        currentPincode: null,
      },
      studentacademicdetails: null,
      studentdocuments: null,
      documents: null,
      timeline: {
        submittedAt: student.createdAt,
        enrolledAt: student.createdAt,
        usnAssignedAt: student.createdAt,
      }
    };
  }

  /** Admin: update application status */
  async updateStatus(
    id: string,
    status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ENROLLED' | 'CORRECTION_REQUIRED' | 'PRINCIPAL_APPROVED',
    adminUserId: string,
    remarks?: string,
    rejectionReason?: string,
    rejectionReasonCode?: string,
    sections?: string[],
    deadline?: string | Date
  ): Promise<string | void> {
    const transaction = await db.transaction();
    try {
      const adminUser = await User.findByPk(adminUserId, { transaction });
      if (!adminUser) throw new Error('Admin user not found');
      
      const admission = await Admission.findByPk(id, { transaction, lock: true });
      if (!admission) throw new Error('Application not found');

      // Security: Enforce allowed state transitions
      const currentStatus = admission.applicationStatus;
      const allowedTransitions: Record<string, string[]> = {
        'DRAFT': ['SUBMITTED'],
        'SUBMITTED': ['UNDER_REVIEW', 'CORRECTION_REQUIRED', 'APPROVED', 'REJECTED'],
        'UNDER_REVIEW': ['CORRECTION_REQUIRED', 'APPROVED', 'REJECTED'],
        'CORRECTION_REQUIRED': ['RESUBMITTED'],
        'RESUBMITTED': ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'],
        'APPROVED': ['PRINCIPAL_APPROVED', 'ENROLLED', 'REJECTED', 'CORRECTION_REQUIRED', 'CANCELLATION_REQUESTED'],
        'PRINCIPAL_APPROVED': ['ENROLLED', 'REJECTED', 'CORRECTION_REQUIRED', 'CANCELLATION_REQUESTED'],
        'ENROLLED': ['CANCELLATION_REQUESTED'],
        'CANCELLATION_REQUESTED': ['CANCELLED', 'APPROVED', 'PRINCIPAL_APPROVED', 'ENROLLED'],
        'CANCELLED': [],
        'REJECTED': [],
        // Legacy compatibility routes:
        'FEE_RECEIPT_UPLOADED': ['APPROVED', 'REJECTED', 'UNDER_REVIEW'],
        'FEE_VERIFIED': ['PRINCIPAL_APPROVED', 'APPROVED', 'REJECTED'],
      };

      const allowedNext = allowedTransitions[currentStatus] || [];
      const isAllowed = status === currentStatus || allowedNext.includes(status) || (currentStatus === 'REJECTED' && adminUser.role === 'SUPER_ADMIN');
      
      if (!isAllowed) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${status}`);
      }

      // Rule: Only SUPER_ADMIN can override an already REJECTED application
      if (admission.applicationStatus === 'REJECTED' && status !== 'REJECTED' && adminUser.role !== 'SUPER_ADMIN') {
        throw new Error('Only a SUPER_ADMIN can override a rejected application.');
      }

      let generatedUsn: string | undefined;

      if (status === 'CORRECTION_REQUIRED') {
        await admission.update({
          applicationStatus: 'CORRECTION_REQUIRED',
          correctionRequestedSections: sections || [],
          correctionRemarks: remarks || null,
          adminRemarks: remarks || null,
          correctionDeadline: deadline ? new Date(deadline) : null,
          correctionRequestedAt: new Date(),
          correctionRequestedById: adminUserId,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        }, { transaction });

        // Trigger Notification to Student
        try {
          const user = await User.findByPk(admission.userId, { transaction });
          if (user) {
            const sectionLabelMap: Record<string, string> = {
              admission: 'Admission Details',
              personal: 'Personal Details',
              parent: 'Parent Details',
              address: 'Address Details',
              academic: 'Academic Details',
              documents: 'Documents Upload'
            };
            const formattedSections = (sections || []).map(s => `• ${sectionLabelMap[s] || s}`).join('\n');
            const deadlineText = deadline ? new Date(deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
            
            const reason = 'Correction requested for the following sections:\n' + formattedSections;
            const notificationRemarks = `${remarks || ''}\n\nPlease resubmit before: ${deadlineText}`;
            
            await emailService.sendCorrectionRequiredNotification(
              user.email,
              {
                studentName: `${user.firstName} ${user.lastName}`.trim(),
                applicationNumber: admission.applicationNumber || admission.id,
                applicationType: 'FRESH_ADMISSION',
                reason,
                remarks: notificationRemarks
              }
            );
          }
        } catch (emailErr: any) {
          console.error('Failed to send correction required email:', emailErr.message);
        }

      } else if (status === 'APPROVED') {
        if (adminUser.role !== 'ADMIN' && adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'PRINCIPAL') {
          throw new Error('Only an ADMIN, SUPER_ADMIN, or PRINCIPAL can verify applications.');
        }

        // ENFORCE CHECKLIST (Admin Document & Eligibility Validation)
        if (!admission.documentsVerified || !admission.eligibilityVerified) {
          throw new Error('Documents and Eligibility verification must be completed before application approval.');
        }

        await admission.update({
          applicationStatus: 'APPROVED',
          adminRemarks: remarks || null,
          verifiedByAdminId: adminUserId,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          verifiedAt: new Date(),
        }, { transaction });

        // Trigger Notification to Student to visit office and pay ₹500 fee
        try {
          const user = await User.findByPk(admission.userId, { transaction });
          if (user) {
            await emailService.sendApplicationApprovedNotification(
              user.email,
              `${user.firstName} ${user.lastName}`.trim(),
              admission.applicationNumber || ''
            );
          }
        } catch (emailErr: any) {
          console.error('Failed to send application approval email:', emailErr.message);
        }

      } else if (status === 'PRINCIPAL_APPROVED') {
        if (adminUser.role !== 'PRINCIPAL' && adminUser.role !== 'SUPER_ADMIN') {
          throw new Error('Only the Principal or SuperAdmin can approve applications.');
        }

        // ENFORCE CHECKLIST (Admin Document & Eligibility Validation)
        if (!admission.documentsVerified) {
          throw new Error('Mandatory documents must be verified before Principal approval.');
        }
        if (!admission.feesVerified) {
          throw new Error('College fee payment verification must be completed before Principal approval.');
        }
        if (!admission.eligibilityVerified) {
          throw new Error('Applicant eligibility verification must be completed before Principal approval.');
        }
        if (admission.applicationStatus === 'CORRECTION_REQUIRED') {
          throw new Error('All pending corrections must be resolved before Principal approval.');
        }

        await admission.update({
          applicationStatus: 'PRINCIPAL_APPROVED',
          principalReviewedBy: adminUserId,
          principalReviewedAt: new Date(),
          principalApprovedAt: new Date(),
          principalRemarks: remarks || null,
        }, { transaction });

        // Trigger Notification to Student for Principal Approval
        try {
          const user = await User.findByPk(admission.userId, { transaction });
          if (user) {
            await emailService.sendApplicationApprovedNotification(
              user.email,
              `${user.firstName} ${user.lastName}`.trim(),
              admission.applicationNumber || ''
            );
          }
        } catch (emailErr: any) {
          console.error('Failed to send application approval email:', emailErr.message);
        }

      } else if (status === 'ENROLLED') {
        if (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ADMIN' && adminUser.role !== 'PRINCIPAL') {
          throw new Error('Only an authorized Admin/Principal/SuperAdmin can finalize enrollment.');
        }

        const personal = await AdmissionPersonalDetail.findOne({ where: { admissionId: id }, transaction });
        const parent = await AdmissionParentDetail.findOne({ where: { admissionId: id }, transaction });
        const addr = await AdmissionAddress.findOne({ where: { admissionId: id }, transaction });

        const enrollmentNumber = (admission.usn || admission.applicationNumber) as string;
        let rollNumber = '';
        let batchYear = new Date().getFullYear();

        if (admission.usn) {
          const match = admission.usn.match(/^2JR(\d{2})([A-Z]{2})(\d{3})$/);
          if (match) {
            batchYear = parseInt('20' + match[1]);
            const usnDeptCode = match[2];
            const usnSeq = match[3];
            rollNumber = `${batchYear}${usnDeptCode}${usnSeq}`;
          } else {
            let branchCode = 'CS';
            if (admission.branchId) {
              const branch = await Department.findByPk(admission.branchId, { transaction });
              if (branch && branch.code) {
                const VTU_MAP: Record<string, string> = {
                  'CSE': 'CS',
                  'CSE-AIML': 'CI',
                  'AIML': 'CI',
                  'AI&ML': 'CI',
                  'AI-ML': 'CI',
                  'CV': 'CV',
                  'CIVIL': 'CV',
                  'CE': 'CV',
                  'ECE': 'EC',
                  'ME': 'ME',
                  'MECHANICAL': 'ME',
                  'ISE': 'IS',
                  'IS': 'IS',
                  'CSE-DS': 'CD',
                  'DS': 'CD',
                  'CSBS': 'CB',
                  'EEE': 'EE',
                  'EE': 'EE'
                };
                const normBranch = branch.code.toUpperCase().trim();
                branchCode = VTU_MAP[normBranch] || normBranch.substring(0, 2);
              }
            }
            const seqStr = String(admission.usn.slice(-3));
            rollNumber = `${batchYear}${branchCode}${seqStr}`;
          }

          // Ensure registry is marked as claimed
          await UsnRegistry.update(
            { status: 'CLAIMED' },
            { where: { usn: admission.usn }, transaction }
          );
        }

        generatedUsn = enrollmentNumber;

        let dobDate: Date | null = null;
        if (personal?.dateOfBirth) {
          if ((personal.dateOfBirth as unknown) instanceof Date) {
            dobDate = (personal.dateOfBirth as unknown) as Date;
          } else if (typeof personal.dateOfBirth === 'string') {
            const parts = personal.dateOfBirth.split('/');
            if (parts.length === 3) {
              dobDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
              dobDate = new Date(personal.dateOfBirth);
            }
          }
        }

        const isLateral = (admission.admissionType === 'DCET' || admission.applicationType === 'LATERAL_ENTRY' || admission.entrySemester === 3);
        const semNum = isLateral ? 3 : 1;
        const effectiveRollNumber = semNum === 1 ? (rollNumber || null) : null;

        // Calculate complete 4-year engineering cohort
        const cohortInfo = calculateStudentCohort({
          academicYear: admission.academicYear,
          admissionType: isLateral ? 'LATERAL' : 'FRESH',
          initialSemester: semNum,
          entrySemester: semNum,
          usn: admission.usn,
        });

        const existingStudent = await Student.findOne({ where: { userId: admission.userId }, transaction });
        let createdStudent = existingStudent;
        if (!existingStudent) {
          createdStudent = await Student.create({
            userId: admission.userId,
            usn: admission.usn || null,
            enrollmentNumber,
            rollNumber: effectiveRollNumber,
            batchYear: cohortInfo.cohortStartYear,
            admissionBatch: cohortInfo.batchDisplay,
            departmentId: admission.branchId!,
            semester: semNum,
            dateOfBirth: dobDate,
            address: addr ? [addr.currentAddressLine1, addr.currentCity, addr.currentState, addr.currentPincode].filter(Boolean).join(', ') : '',
            fatherName: parent?.fatherName || '',
            motherName: parent?.motherName || '',
            parentPhone: parent?.fatherPhone || '',
            parentEmail: parent?.fatherEmail || '',
            admissionStatus: 'APPROVED',
            admissionType: isLateral ? 'LATERAL' : 'FRESH',
            initialSemester: semNum,
            currentAcademicYear: admission.academicYear || '2026-2027',
          }, { transaction });
        } else {
          if (!existingStudent.admissionBatch) {
            await existingStudent.update({
              batchYear: cohortInfo.cohortStartYear,
              admissionBatch: cohortInfo.batchDisplay,
            }, { transaction });
          }
          generatedUsn = existingStudent.enrollmentNumber;
        }

        if (createdStudent) {
          const [enrollment, created] = await StudentAcademicEnrollment.findOrCreate({
            where: {
              studentId: createdStudent.id,
              academicYearId: admission.academicYear || '2026-27',
            },
            defaults: {
              studentId: createdStudent.id,
              academicYearId: admission.academicYear || '2026-27',
              schemeId: '2025',
              departmentId: admission.branchId!,
              semesterId: semNum,
              rollNumber: effectiveRollNumber,
              entrySemester: semNum,
              status: 'ACTIVE',
            },
            transaction,
          });
          if (!created && enrollment.departmentId !== admission.branchId) {
            await enrollment.update({ departmentId: admission.branchId!, semesterId: semNum }, { transaction });
          }
        }

        // Elevate user role to STUDENT and auto-assign USN as username
        const user = await User.findByPk(admission.userId, { transaction });
        if (user) {
          const userUpdates: any = { username: enrollmentNumber };
          if (user.role !== 'STUDENT') {
            userUpdates.role = 'STUDENT';
          }
          await user.update(userUpdates, { transaction });
        }

        const isPrincipal = adminUser.role === 'PRINCIPAL';
        const preservedAdminId = isPrincipal
          ? (admission.approvedByAdminId && admission.approvedByAdminId !== adminUserId
              ? admission.approvedByAdminId
              : (admission.verifiedByAdminId || null))
          : adminUserId;

        await admission.update({
          applicationStatus: 'ENROLLED',
          approvalRemarks: remarks || null,
          approvedByAdminId: preservedAdminId,
          principalReviewedBy: isPrincipal ? adminUserId : admission.principalReviewedBy,
          principalApprovedAt: isPrincipal ? new Date() : admission.principalApprovedAt,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          enrolledAt: new Date(),
        }, { transaction });

      } else {
        let finalRejectionReason = rejectionReason;
        if (status === 'REJECTED' && rejectionReasonCode) {
          const reasonObj = await RejectionReason.findOne({ where: { code: rejectionReasonCode }, transaction });
          if (reasonObj) {
            finalRejectionReason = reasonObj.label;
          }
        }

        await admission.update({
          applicationStatus: status,
          adminRemarks: remarks || null,
          rejectionReason: status === 'REJECTED' ? finalRejectionReason || remarks || null : null,
          rejectionReasonCode: status === 'REJECTED' ? rejectionReasonCode || null : null,
          rejectedByAdminId: status === 'REJECTED' ? adminUserId : null,
          rejectedAt: status === 'REJECTED' ? new Date() : null,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        }, { transaction });
      }

      await transaction.commit();
      await this.invalidateCacheByAdmissionId(id);
      return generatedUsn;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /** Admin: Verify Admission Checklist */
  async verifyChecklist(
    id: string,
    adminUserId: string,
    payload: {
      documentsVerified?: boolean;
      feesVerified?: boolean;
      eligibilityVerified?: boolean;
      verificationRemarks?: string;
    }
  ): Promise<void> {
    const transaction = await db.transaction();
    try {
      const admission = await Admission.findByPk(id, { transaction, lock: true });
      if (!admission) throw new Error('Application not found');
      
      const documentsVerified = payload.documentsVerified ?? admission.documentsVerified;
      const eligibilityVerified = payload.eligibilityVerified ?? admission.eligibilityVerified;
      const feesVerified = payload.feesVerified ?? (documentsVerified ? true : admission.feesVerified);

      await admission.update({
        documentsVerified,
        feesVerified,
        eligibilityVerified,
        verificationRemarks: payload.verificationRemarks !== undefined ? payload.verificationRemarks : admission.verificationRemarks,
        verifiedByAdminId: adminUserId,
        verifiedAt: new Date(),
      }, { transaction });

      await transaction.commit();
      await this.invalidateCacheByAdmissionId(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async saveDocumentStatuses(
    id: string,
    statuses: Record<string, 'ACCEPTED' | 'REJECTED' | 'PENDING'>
  ): Promise<void> {
    const admission = await Admission.findByPk(id);
    if (!admission) throw new Error('Application not found');
    
    await admission.update({
      verifiedDocuments: statuses
    });
    await this.invalidateCacheByAdmissionId(id);
  }

  /** Student: Upload official ₹500 fee receipt image/PDF */
  async uploadFeeReceipt(userId: string, receiptUrl: string): Promise<any> {
    const admission = await Admission.findOne({ where: { userId } });
    if (!admission) throw new Error('Application not found.');

    if (!['APPROVED', 'FEE_RECEIPT_UPLOADED'].includes(admission.applicationStatus)) {
      throw new Error('Fee receipt can only be uploaded after application approval.');
    }

    const transaction = await db.transaction();
    try {
      let docs = await AdmissionDocument.findOne({ where: { admissionId: admission.id }, transaction });
      if (docs) {
        await docs.update({ admissionFeeReceiptUrl: receiptUrl }, { transaction });
      } else {
        await AdmissionDocument.create({ admissionId: admission.id, admissionFeeReceiptUrl: receiptUrl }, { transaction });
      }

      await admission.update({
        admissionFeeReceiptUrl: receiptUrl,
        applicationStatus: 'FEE_RECEIPT_UPLOADED',
        feeReceiptUploadedAt: new Date(),
        feeRejectionReason: null,
      }, { transaction });

      await transaction.commit();
      await this.invalidateCache(userId);

      // Trigger Email/SMS notification to Admin team
      try {
        const user = await User.findByPk(userId);
        if (user) {
          await emailService.sendFeeReceiptUploadedNotification({
            studentName: `${user.firstName} ${user.lastName}`.trim(),
            applicationNumber: admission.applicationNumber || '',
            studentEmail: user.email,
          });
        }
      } catch (err: any) {
        console.error('Failed to send fee receipt upload notification email:', err.message);
      }

      return { success: true, message: 'Fee receipt uploaded successfully.' };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /** Admin: Verify uploaded fee receipt and forward to Principal */
  async verifyFeeReceipt(
    admissionId: string,
    adminUserId: string,
    payload: { approve: boolean; remarks?: string; rejectionReason?: string }
  ): Promise<any> {
    const transaction = await db.transaction();
    try {
      const admission = await Admission.findByPk(admissionId, { transaction, lock: true });
      if (!admission) throw new Error('Application not found.');

      if (payload.approve) {
        await admission.update({
          feesVerified: true,
          applicationStatus: 'FEE_VERIFIED',
          feeVerifiedByAdminId: adminUserId,
          feeVerifiedAt: new Date(),
          feeVerificationRemarks: payload.remarks || null,
          feeRejectionReason: null,
        }, { transaction });

        // Trigger Notification to Principal
        try {
          const user = await User.findByPk(admission.userId);
          if (user) {
            await emailService.sendFeeVerifiedNotificationToPrincipal({
              studentName: `${user.firstName} ${user.lastName}`.trim(),
              applicationNumber: admission.applicationNumber || '',
            });
          }
        } catch (err: any) {
          console.error('Failed to send fee verified notification to principal:', err.message);
        }
      } else {
        await admission.update({
          feesVerified: false,
          applicationStatus: 'APPROVED', // Require student to re-upload receipt
          feeRejectionReason: payload.rejectionReason || payload.remarks || 'Uploaded fee receipt was rejected. Please upload a clear official receipt.',
          feeVerificationRemarks: payload.remarks || null,
        }, { transaction });
      }

      await transaction.commit();
      await this.invalidateCacheByAdmissionId(admissionId);
      return { success: true, message: payload.approve ? 'Fee receipt verified and forwarded to Principal.' : 'Fee receipt rejected.' };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /** Admin: stats for dashboard */
  async getDashboardStats(): Promise<any> {
    // Real-time stats are critical for the admin dashboard queue to prevent stale counts.
    // Query the database directly to ensure accuracy.

    const [
      totalAdmissions,
      draftCount,
      submitted,
      resubmitted,
      underReview,
      approvedCount,
      _approvedByPrincipalCount,
      rejected,
      enrolledAdmissions,
      cancellationRequests,
      feeReceiptUploadedCount,
      feeVerifiedCount,
      correctionRequiredCount,
      cancelledCount,
      provisionalCount,
      totalEnrolledStudents,
      existingOnboardedCount,
    ] = await Promise.all([
      Admission.count({ where: { applicationStatus: { [Op.ne]: 'DRAFT' } } }),
      Admission.count({ where: { applicationStatus: 'DRAFT' } }),
      Admission.count({
        where: {
          applicationStatus: 'SUBMITTED'
        }
      }),
      Admission.count({
        where: {
          applicationStatus: 'RESUBMITTED'
        }
      }),
      Admission.count({
        where: {
          applicationStatus: 'UNDER_REVIEW'
        }
      }),
      Admission.count({ where: { applicationStatus: { [Op.in]: ['APPROVED', 'PRINCIPAL_APPROVED'] } } }),
      Promise.resolve(0), // FEE_VERIFIED count
      Admission.count({ where: { applicationStatus: 'REJECTED' } }),
      Admission.count({ where: { applicationStatus: 'ENROLLED' } }),
      Admission.count({ where: { applicationStatus: 'CANCELLATION_REQUESTED' } }),
      Promise.resolve(0), // FEE_RECEIPT_UPLOADED count
      Promise.resolve(0), // duplicate FEE_VERIFIED count
      Admission.count({ where: { applicationStatus: 'CORRECTION_REQUIRED' } }),
      Admission.count({ where: { applicationStatus: 'CANCELLED' } }),
      ProvisionalAdmission.count({ where: { status: { [Op.in]: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] } } }),
      Student.count({ where: { admissionStatus: 'APPROVED' } }),
      Student.count({ where: { admissionType: 'EXISTING' } }),
    ]);

    const recent = await Admission.findAll({
      where: { applicationStatus: { [Op.in]: ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'] } },
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName', 'profileImage'] },
        { model: Department, as: 'branch' },
      ],
      order: [['updatedAt', 'DESC']],
      limit: 5,
    });

    const enrolled = Math.max(totalEnrolledStudents, enrolledAdmissions + existingOnboardedCount);
    const total = totalAdmissions + existingOnboardedCount;

    const result = { 
      total, 
      registered: draftCount, // compatibility fallback
      draft: draftCount, 
      submitted, 
      resubmitted,
      underReview, 
      approved: approvedCount, 
      rejected, 
      enrolled, 
      cancellationRequests,
      cancelled: cancelledCount,
      feeReceiptUploaded: feeReceiptUploadedCount,
      feeVerified: feeVerifiedCount,
      correctionRequired: correctionRequiredCount,
      provisionalCount,
      recent 
    };

    return result;
  }
}

export default new AdmissionService();

