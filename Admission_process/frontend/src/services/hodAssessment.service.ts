import API from './api';

export interface AssessmentOverviewStats {
  totalRequiringReview: number;
  pendingReview: number;
  returned: number;
  resubmitted: number;
  approved: number;
  published: number;
  totalAssessments: number;
}

export interface AssessmentSubmissionItem {
  id: string;
  assessmentType: 'CIE1' | 'CIE2' | string;
  academicYear: string;
  semester: number;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  maximumMarks: number;
  status: 'DRAFT' | 'SAVED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'RETURNED' | 'RESUBMITTED' | 'APPROVED' | 'PUBLISHED';
  isPublished: boolean;
  submittedAt: string | null;
  submittedBy: string | null;
  allocatedFaculty: {
    id: string;
    name: string;
    email: string;
  } | null;
  studentCount: number;
  hodReviewComment: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  submissionCount: number;
}

export interface AssessmentReviewStudentRow {
  slNo: number;
  studentId: string;
  usn: string;
  studentName: string;
  rawQuestionTotals: Record<string, number>;
  bestOfDetails: any;
  finalCieMarks: number;
  percentage: number;
  completionStatus: string;
  subquestionMarks: Record<string, number | null>;
}

export interface ReviewHistoryEvent {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  actorRole: string;
  actorName: string | null;
  comments: string | null;
  metadata: any;
  createdAt: string;
  actor?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface AssessmentReviewDetailData {
  assessment: {
    id: string;
    assessmentType: string;
    academicYear: string;
    semester: number;
    departmentCode: string;
    departmentName: string;
    subjectCode: string;
    subjectName: string;
    maximumMarks: number;
    questionPattern: any[];
    attemptRules: any;
    status: string;
    isPublished: boolean;
    submittedAt: string | null;
    submittedBy: string | null;
    hodReviewComment: string | null;
    reviewedAt: string | null;
    approvedAt: string | null;
    publishedAt: string | null;
    submissionCount: number;
  };
  students: AssessmentReviewStudentRow[];
  reviewHistory: ReviewHistoryEvent[];
}

export const hodAssessmentService = {
  /**
   * Retrieves summary statistics for HOD dashboard
   */
  async getOverviewStats(): Promise<AssessmentOverviewStats> {
    const res = await API.get('/hod/assessments/overview');
    return res.data.data;
  },

  /**
   * Lists assessment submissions within HOD's authorized scope
   */
  async getSubmissions(params?: {
    academicYear?: string;
    semester?: number;
    departmentId?: string;
    subjectId?: string;
    assessmentType?: string;
    status?: string;
    search?: string;
  }): Promise<{ submissions: AssessmentSubmissionItem[]; scope: { departmentName: string; departmentCode: string; isSemesterHandling: boolean } }> {
    const res = await API.get('/hod/assessments', { params });
    return {
      submissions: res.data.data || [],
      scope: res.data.scope || { departmentName: 'Engineering', departmentCode: 'ENG', isSemesterHandling: false },
    };
  },

  /**
   * Retrieves full student roster, marks, and review history
   */
  async getReviewDetail(assessmentId: string): Promise<AssessmentReviewDetailData> {
    const res = await API.get(`/hod/assessments/${assessmentId}`);
    return res.data.data;
  },

  /**
   * Approves and publishes marks to students
   */
  async approveAndPublish(assessmentId: string, options?: { publishNow?: boolean }): Promise<any> {
    const res = await API.post(`/hod/assessments/${assessmentId}/approve-publish`, options || { publishNow: true });
    return res.data;
  },

  /**
   * Returns assessment for correction with mandatory comments
   */
  async returnForCorrection(assessmentId: string, comment: string): Promise<any> {
    const res = await API.post(`/hod/assessments/${assessmentId}/return`, { comment });
    return res.data;
  },
};

export default hodAssessmentService;
