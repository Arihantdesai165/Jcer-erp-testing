import API from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdmissionStatus =
  | 'REGISTERED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUIRED'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'PRINCIPAL_APPROVED'
  | 'FEE_RECEIPT_UPLOADED'
  | 'FEE_VERIFIED'
  | 'REJECTED'
  | 'ENROLLED'
  | 'CANCELLATION_REQUESTED'
  | 'CANCELLED';

export interface AdmissionApplication {
  id: string;
  applicationNumber: string;
  usn?: string | null;
  admissionType: string | null;
  qualification: string | null;
  aadhaar?: string;
  cetNumber?: string;
  dcetNumber?: string;
  applicationStatus: AdmissionStatus;
  documentsVerified?: boolean;
  feesVerified?: boolean;
  eligibilityVerified?: boolean;
  verificationRemarks?: string;
  adminRemarks?: string;
  rejectionReason?: string;
  rejectionReasonCode?: string;
  reviewedBy?: string;
  submittedAt: string | null;
  resubmittedAt?: string | null;
  reviewedAt: string | null;
  approvedByAdminId?: string | null;
  approvedByAdminAt?: string | null;
  approvalRemarks?: string | null;
  feeReceiptUploadedAt?: string | null;
  admissionFeeReceiptUrl?: string | null;
  feeVerifiedByAdminId?: string | null;
  feeVerifiedAt?: string | null;
  feeVerificationRemarks?: string | null;
  feeRejectionReason?: string | null;
  enrolledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string | null;
  correctionRequestedSections?: string[] | null;
  correctionRemarks?: string | null;
  verifiedDocuments?: Record<string, 'ACCEPTED' | 'REJECTED'> | null;
  correctionDeadline?: string | null;
  correctionRequestedAt?: string | null;
  correctionRequestedById?: string | null;
  academicYear?: string | null;
  entrySemester?: number | null;
  cancellationReason?: string | null;
  cancellationRemarks?: string | null;
  cancellationAdminRemarks?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationRequestedById?: string | null;
  cancellationApprovedAt?: string | null;
  verifiedByAdmin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
  } | null;
  correctionRequestedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
  } | null;
  rejectedByAdmin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
  } | null;
  approvedByAdmin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
  } | null;
  rejectedByAdminId?: string | null;
  rejectedAt?: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profileImage: string | null;
    student?: {
      id?: string;
      usn?: string | null;
      enrollmentNumber: string;
      semester?: number | null;
    } | null;
  } | null;
  branch: {
    id: string;
    name: string;
    code: string;
  } | null;
  studentpersonaldetails: {
    firstName: string;
    lastName: string;
    middleName: string | null;
    dateOfBirth: string | null;
    dob?: string | null;
    gender: string | null;
    category: string | null;
    religion: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
    caste?: string | null;
    studiedInKarnataka?: boolean | null;
    areaType?: string | null;
    aadhaarNumber?: string | null;
    bloodGroup?: string | null;
    maritalStatus?: string | null;
    alternatePhone?: string | null;
  } | null;
  studentparentdetails: {
    fatherName: string | null;
    fatherOccupation: string | null;
    fatherPhone: string | null;
    fatherEmail: string | null;
    fatherAnnualIncome: number | null;
    motherName: string | null;
    motherOccupation: string | null;
    motherPhone: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    parentPhone?: string | null;
  } | null;
  studentaddress: {
    currentAddressLine1: string | null;
    currentAddressLine2: string | null;
    currentCity: string | null;
    currentTaluk?: string | null;
    currentDistrict?: string | null;
    currentDistrictId?: string | null;
    currentState: string | null;
    currentPincode: string | null;
    sameAsCurrent: boolean;
    permanentAddressLine1: string | null;
    permanentCity: string | null;
    permanentTaluk?: string | null;
    permanentDistrict?: string | null;
    permanentDistrictId?: string | null;
    permanentState: string | null;
    permanentPincode: string | null;
    permanentAddress?: string | null;
    currentAddress?: string | null;
  } | null;
  studentacademicdetails: {
    tenthSchool: string | null;
    tenthBoard: string | null;
    tenthPassingYear: number | null;
    tenthPercentage: number | null;
    tenthRegisterNumber?: string | null;
    tenthMarksObtained?: number | null;
    tenthObtainedMarks?: number | null;
    tenthMaxMarks?: number | null;
    tenthAttempts?: number | null;
    sslcBoard?: string | null;
    sslcSchool?: string | null;
    sslcYear?: number | null;
    twelfthSchool: string | null;
    twelfthCollege?: string | null;
    twelfthBoard: string | null;
    twelfthPassingYear: number | null;
    twelfthPercentage: number | null;
    twelfthStream: string | null;
    twelfthRegisterNumber?: string | null;
    twelfthMaxMarks?: number | null;
    twelfthObtainedMarks?: number | null;
    twelfthAttempts?: number | null;
    physicsMarks?: number | null;
    mathsMarks?: number | null;
    chemistryMarks?: number | null;
    optionalSubject?: string | null;
    optionalMarks?: number | null;
    diplomaUniversity?: string | null;
    diplomaYear?: string | null;
    diplomaRegisterNumber?: string | null;
    diplomaFinalYearMaxMarks?: number | null;
    diplomaFinalYearObtained?: number | null;
    diplomaPercentage?: number | null;
    diplomaAttempts?: number | null;
    cetScore: number | null;
    cetRank: number | null;
    cetYear: number | null;
    entranceRank?: number | null;
    entranceAttempts?: number | null;
    hasGap: boolean;
    gapReason: string | null;
  } | null;
  studentdocuments: {
    photoUrl: string | null;
    signatureUrl: string | null;
    tenthMarksheetUrl: string | null;
    twelfthMarksheetUrl: string | null;
    diplomaSemester5MarksheetUrl?: string | null;
    diplomaSemester6MarksheetUrl?: string | null;
    cetScoreCardUrl: string | null;
    aadhaarUrl: string | null;
    casteCertificateUrl: string | null;
    domicileCertificateUrl: string | null;
    gapCertificateUrl: string | null;
    feesPaidReceiptUrl: string | null;
    admissionFeeReceiptUrl?: string | null;
    admissionFormFeeReceiptUrl?: string | null;
    admissionFormFeePaymentMode?: string | null;
    admissionFormFeeUtr?: string | null;
  } | null;
}

export interface AdmissionListResult {
  total: number;
  page: number;
  totalPages: number;
  applications: AdmissionApplication[];
}

export interface AdmissionStats {
  total: number;
  registered: number;
  draft?: number;
  submitted: number;
  resubmitted?: number;
  underReview: number;
  approved: number;
  rejected: number;
  enrolled: number;
  cancellationRequests?: number;
  feeReceiptUploaded?: number;
  feeVerified?: number;
  correctionRequired?: number;
  provisionalCount?: number;
  recent: AdmissionApplication[];
}

// ─── Admin Admission Service ──────────────────────────────────────────────────

const admissionService = {
  /** GET /api/admin/admissions — paginated list with optional filters */
  async listApplications(params: {
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
  }): Promise<AdmissionListResult> {
    const query = new URLSearchParams();
    if (params.page)     query.set('page',     String(params.page));
    if (params.limit)    query.set('limit',    String(params.limit));
    if (params.status)   query.set('status',   params.status);
    if (params.search)   query.set('search',   params.search);
    if (params.branchId) query.set('branchId', params.branchId);
    if (params.semester) query.set('semester', params.semester);
    if (params.admissionType) query.set('admissionType', params.admissionType);
    if (params.sortBy)    query.set('sortBy',    params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.qualification) query.set('qualification', params.qualification);
    if (params.gender) query.set('gender', params.gender);
    if (params.category) query.set('category', params.category);
    if (params.district) query.set('district', params.district);
    if (params.academicYear) query.set('academicYear', params.academicYear);
    if (params.batch) query.set('batch', params.batch);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.includeFullDetails) query.set('includeFullDetails', 'true');

    const res = await API.get(`/admin/admissions?${query.toString()}`);
    const data = res.data.data;
    if (Array.isArray(data)) {
      return {
        applications: data,
        total: res.data.total || data.length || 0,
        page: params.page || 1,
        totalPages: Math.ceil((res.data.total || data.length || 0) / (params.limit || 20)) || 1
      } as AdmissionListResult;
    }
    if (data && typeof data === 'object' && 'applications' in data) {
      return data as AdmissionListResult;
    }
    // Fallback: empty result
    return { applications: [], total: 0, page: params.page || 1, totalPages: 1 };
  },

  /** GET /api/admin/admissions/batches — available distinct cohort batches */
  async getAvailableBatches(): Promise<string[]> {
    try {
      const res = await API.get('/admin/admissions/batches');
      if (res.data?.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return ['2026–2030', '2025–2029', '2024–2028', '2023–2027', '2022–2026', '2021–2025'];
    } catch {
      return ['2026–2030', '2025–2029', '2024–2028', '2023–2027', '2022–2026', '2021–2025'];
    }
  },

  /** GET /api/admin/admissions/:id — full application detail */
  async getApplication(id: string): Promise<AdmissionApplication> {
    const res = await API.get(`/admin/admissions/${id}`);
    return res.data.data as AdmissionApplication;
  },

  updateStatus: async (
    id: string,
    status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ENROLLED' | 'CORRECTION_REQUIRED',
    remarks?: string,
    rejectionReason?: string,
    rejectionReasonCode?: string,
    sections?: string[],
    deadline?: string
  ): Promise<void> => {
    await API.put(`/admin/admissions/${id}/status`, { status, remarks, rejectionReason, rejectionReasonCode, sections, deadline });
    window.dispatchEvent(new CustomEvent('admissions-updated'));
  },

  /** PUT /api/admin/admissions/:id/verify */
  verifyChecklist: async (id: string, payload: { documentsVerified?: boolean, feesVerified?: boolean, eligibilityVerified?: boolean, verificationRemarks?: string }): Promise<void> => {
    await API.put(`/admin/admissions/${id}/verify`, payload);
    window.dispatchEvent(new CustomEvent('admissions-updated'));
  },

  /** PUT /api/admin/admissions/:id/documents/status */
  saveDocumentStatuses: async (id: string, statuses: Record<string, 'ACCEPTED' | 'REJECTED' | 'PENDING'>): Promise<void> => {
    await API.put(`/admin/admissions/${id}/documents/status`, { statuses });
    window.dispatchEvent(new CustomEvent('admissions-updated'));
  },

  /** POST /api/admin/admissions/:id/fee-verify */
  verifyFeeReceipt: async (id: string, payload: { approve: boolean; remarks?: string; rejectionReason?: string }): Promise<void> => {
    await API.post(`/admin/admissions/${id}/fee-verify`, payload);
    window.dispatchEvent(new CustomEvent('admissions-updated'));
  },

  /** POST /api/student/upload-fee-receipt */
  uploadFeeReceipt: async (formData: FormData): Promise<void> => {
    await API.post('/student/upload-fee-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    window.dispatchEvent(new CustomEvent('admissions-updated'));
  },

  /** GET /api/admin/stats — dashboard stats + recent applications */
  async getStats(): Promise<AdmissionStats> {
    const res = await API.get('/admin/stats');
    return res.data.data as AdmissionStats;
  },

  /** GET /api/branches */
  async getBranches(): Promise<{ id: string; name: string; code: string }[]> {
    const res = await API.get('/branches');
    return res.data.data;
  },

  requestCancellation: async (reason: string, remarks?: string): Promise<void> => {
    await API.post('/student/cancellation-request', { reason, remarks });
    window.dispatchEvent(new CustomEvent('admissions-updated'));
  },

  processCancellation: async (id: string, action: 'APPROVE' | 'REJECT', remarks?: string): Promise<void> => {
    await API.post(`/admin/admissions/${id}/cancellation-process`, { action, remarks });
    window.dispatchEvent(new CustomEvent('admissions-updated'));
  },

  directCancel: async (id: string, reason: string, remarks?: string): Promise<void> => {
    await API.post(`/admin/admissions/${id}/cancellation-direct`, { reason, remarks });
    window.dispatchEvent(new CustomEvent('admissions-updated'));
  },

  /** GET /api/admin/usn/eligible */
  async listUsnEligible(filters: {
    academicYear?: string;
    branchId?: string;
    semester?: string;
    entryType?: string;
    usnStatus?: string;
    search?: string;
    alphabet?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    total: number;
    page: number;
    totalPages: number;
    applicants: any[];
  }> {
    const res = await API.get('/admin/usn/eligible', { params: filters });
    return res.data;
  },

  /** GET /api/admin/usn/summary */
  async getUsnSummary(params?: {
    academicYear?: string;
    branchId?: string;
    semester?: string;
    entryType?: string;
  }): Promise<{
    totalEligible: number;
    assigned: number;
    pending: number;
    completionRate: number;
  }> {
    const res = await API.get('/admin/usn/summary', { params });
    return res.data.data;
  },

  /** POST /api/admin/usn/bulk-assign */
  async bulkAssignUsns(assignments: { applicationId: string; usn: string | null }[]): Promise<any> {
    const res = await API.post('/admin/usn/bulk-assign', { assignments });
    window.dispatchEvent(new CustomEvent('admissions-updated'));
    return res.data;
  },

  /** PATCH /api/admin/usn/:id */
  async assignSingleUsn(id: string, usn: string | null): Promise<any> {
    const res = await API.patch(`/admin/usn/${id}`, { usn });
    window.dispatchEvent(new CustomEvent('admissions-updated'));
    return res.data;
  },

  /** DELETE /api/admin/usn/:id */
  async removeUsn(id: string): Promise<any> {
    const res = await API.delete(`/admin/usn/${id}`);
    window.dispatchEvent(new CustomEvent('admissions-updated'));
    return res.data;
  },

  /** POST /api/admin/usn/validate-import */
  async validateImportUsns(rows: { applicationNumber: string; usn: string }[]): Promise<{
    success: boolean;
    results: any[];
  }> {
    const res = await API.post('/admin/usn/validate-import', { rows });
    return res.data;
  },
};

export default admissionService;
