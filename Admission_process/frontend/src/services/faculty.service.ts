import axios from 'axios';

const API_BASE_URL = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

export interface FacultyAssignmentItem {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  cycle?: string | null;
  schemeId?: string | null;
  credits: number;
  type: string;
  semester: number;
  section: string;
  normalizedSection: string;
  academicYear: string;
  departmentId: string;
  departmentCode: string;
  attendanceAccess: boolean;
  marksAccess: boolean;
  totalStudents: number;
  attendancePercentage: number | null;
  completedToday?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface FacultyAllSubjectCohort {
  academicYear: string;
  semester: number;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  sections: string[];
  hasCohortAccess: boolean;
}

export interface ConsolidatedSubjectStat {
  conducted: number;
  attended: number;
  percentage: number | null;
}

export interface ConsolidatedStudentRow {
  id: string;
  usn: string;
  name: string;
  section: string;
  sectionId: string | null;
  subjectStats: Record<string, ConsolidatedSubjectStat>;
  totalConducted: number;
  totalAttended: number;
  overallPercentage: number | null;
  eligibility: 'Eligible' | 'Not Eligible' | 'No Records';
}

export interface ConsolidatedSubjectSummary {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  conductedClasses: number;
  averagePercentage: number | null;
  eligibleCount: number;
  notEligibleCount: number;
  noRecordsCount: number;
}

export interface ConsolidatedSectionSummary {
  section: string;
  totalStudents: number;
  averagePercentage: number | null;
  eligibleCount: number;
  notEligibleCount: number;
}

export interface FacultyConsolidatedAttendanceData {
  department: {
    id: string;
    name: string;
    code: string;
  };
  academicYear: string;
  semester: number;
  fileName: string;
  sections: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; code: string; credits?: number; type?: string }>;
  students: ConsolidatedStudentRow[];
  subjectSummaries: ConsolidatedSubjectSummary[];
  sectionSummaries: ConsolidatedSectionSummary[];
}

export interface FacultyDashboardData {
  profile: {
    user: any;
    teacher: any;
    departmentId: string | null;
    departmentCode: string;
    departmentName: string;
    designation: string;
  };
  stats: {
    totalAssignments: number;
    assignedSubjectsCount?: number;
    attendanceCoursesCount: number;
    marksCoursesCount: number;
  };
  assignments: FacultyAssignmentItem[];
}

export interface StudentAttendanceRow {
  id: string;
  studentId: string;
  usn: string;
  enrollmentNumber: string;
  rollNumber: string;
  studentName: string;
  email: string;
  section: string;
  classesConducted: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  attendancePercentage: number;
  status: 'Eligible' | 'Shortage';
  sessions: { [date: string]: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'UNRECORDED' };
}

export interface RecordedSessionItem {
  date: string;
  sessionPeriod: number;
  totalConducted: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
  absentStudents: Array<{ id: string; usn: string; studentName: string }>;
}

export interface FacultyAttendanceWorkspaceData {
  assignment: {
    id: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    semester: number;
    section: string;
    academicYear: string;
    departmentCode: string;
  };
  metrics: {
    totalClassesConducted: number;
    totalStudents: number;
    overallAttendancePercentage: number;
    eligibleCount: number;
    shortageCount: number;
    threshold: number;
  };
  conductedDates: string[];
  recordedSessions?: RecordedSessionItem[];
  previousClass?: RecordedSessionItem | null;
  students: StudentAttendanceRow[];
}

export interface AttendanceHistorySessionItem {
  id: string;
  date: string;
  sessionPeriod: number;
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
  submittedAt: string | null;
  submittedById?: string;
  submittedByFacultyName?: string;
  canEdit?: boolean;
}

export interface AttendanceHistoryData {
  assignment: {
    id: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    semester: number;
    section: string;
    academicYear: string;
    departmentCode: string;
  };
  totalSessions: number;
  sessions: AttendanceHistorySessionItem[];
}

export interface ScheduledSessionItem {
  id: string;
  date: string;
  classroom: string;
  startTime: string;
  endTime: string;
  status: 'Completed' | 'Pending' | 'Cancelled';
  rawStatus: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
  submittedAt: string;
  cancellationReason: string | null;
  cancelledAt: string | null;
}

export interface CompleteAttendanceData {
  assignment: {
    id: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    semester: number;
    section: string;
    academicYear: string;
    departmentName: string;
    departmentCode: string;
    classroom: string;
  };
  summary: {
    totalScheduled: number;
    classesHeld: number;
    pendingCount: number;
    cancelledCount: number;
  };
  sessions: ScheduledSessionItem[];
}

export interface CorrectionStudentRow {
  slNo: number;
  studentId: string;
  usn: string;
  studentName: string;
  section: string;
  currentStatus: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  attendanceRecordId: string | null;
}

export interface AttendanceCorrectionLogItem {
  id: string;
  sessionId?: string;
  date?: string;
  sessionPeriod?: number;
  studentId: string;
  studentUsn: string;
  studentName: string;
  oldStatus: string;
  newStatus: string;
  reason: string;
  remarks: string;
  correctedByFacultyName: string;
  createdAt: string;
}

export interface AttendanceSessionDetailData {
  session: {
    id: string;
    date: string;
    sessionPeriod: number;
    status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    percentage: number;
    isLocked: boolean;
    canEdit?: boolean;
    isEditable?: boolean;
    submittedById?: string;
    submittedByFacultyName?: string;
  };
  assignment: {
    id: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    departmentName: string;
    departmentCode: string;
    semester: number;
    section: string;
    academicYear: string;
  };
  students: CorrectionStudentRow[];
  corrections: AttendanceCorrectionLogItem[];
}


export interface FacultyAnalyticsData {
  assignedCount: number;
  subjectAttendanceStats: Array<{
    assignmentId: string;
    subjectName: string;
    subjectCode: string;
    semester: number;
    section: string;
    totalStudents: number;
    attendancePercentage: number;
    threshold: number;
  }>;
  defaulters: Array<{
    studentId: string;
    usn: string;
    studentName: string;
    subjectName: string;
    subjectCode: string;
    totalClasses: number;
    presentClasses: number;
    attendancePercentage: number;
  }>;
  defaultersCount: number;
  termStatus: string;
}

export interface FacultyStudentSearchResult {
  id: string;
  name: string;
  usn: string;
  department: string;
  departmentCode: string;
  semester: number;
  section: string;
  sectionId: string | null;
  assignedSubjectsCount: number;
}

export interface FacultyStudentSubjectAttendance {
  facultyAssignmentId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  type: string;
  sectionId: string | null;
  sectionName: string;
  semester: number;
  academicYear: string;
  conductedClasses: number;
  attendedClasses: number;
  absentClasses: number;
  excusedClasses: number;
  attendancePercentage: number | null;
  eligibilityStatus: 'Eligible' | 'Not Eligible' | 'No Records';
  threshold: number;
  canCorrect: boolean;
  latestSessionId: string | null;
  recentSessions: Array<{
    sessionId: string;
    date: string;
    period: number;
    status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  }>;
}

export interface FacultyStudentAttendanceData {
  student: {
    id: string;
    name: string;
    usn: string;
    department: string;
    departmentCode: string;
    semester: number;
    section: string;
  };
  subjects: FacultyStudentSubjectAttendance[];
  message?: string;
}

export const facultyService = {
  /**
   * Fetches full dashboard overview data
   */
  async getDashboard(academicYear?: string, semester?: string): Promise<FacultyDashboardData> {
    const params = new URLSearchParams();
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);
    if (semester && semester !== 'ALL') params.append('semester', semester);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await axios.get(`${API_BASE_URL}/faculty/dashboard${qs}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Fetches all active assignments for current faculty
   */
  async getAssignments(academicYear?: string): Promise<FacultyAssignmentItem[]> {
    const params = new URLSearchParams();
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await axios.get(`${API_BASE_URL}/faculty/assignments${qs}`, getAuthHeaders());
    return res.data.data || [];
  },

  /**
   * Fetches teaching profile, eligibility, and capabilities for current faculty
   */
  async getTeachingProfile(): Promise<any> {
    const res = await axios.get(`${API_BASE_URL}/faculty/teaching-profile`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Fetches attendance-authorized courses
   */
  async getAttendanceCourses(semester?: string, academicYear?: string): Promise<FacultyAssignmentItem[]> {
    const params = new URLSearchParams();
    if (semester && semester !== 'ALL') params.append('semester', semester);
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const res = await axios.get(`${API_BASE_URL}/faculty/attendance${queryString}`, getAuthHeaders());
    return res.data.data || [];
  },

  /**
   * Fetches detailed attendance workspace for a single course
   */
  async getAttendanceWorkspace(assignmentId: string): Promise<FacultyAttendanceWorkspaceData> {
    const res = await axios.get(`${API_BASE_URL}/faculty/attendance/${assignmentId}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Downloads official Class-wise Attendance Register Excel spreadsheet
   */
  async exportAttendanceExcel(assignmentId: string): Promise<void> {
    const res = await axios.get(`${API_BASE_URL}/faculty/attendance/${assignmentId}/export`, {
      ...getAuthHeaders(),
      responseType: 'blob',
    });

    let filename = `Attendance_Register_${assignmentId}.xlsx`;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Records or updates daily attendance for a course
   */
  async saveAttendance(
    assignmentId: string,
    payload: {
      date: string;
      sessionPeriod?: number;
      records: Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' | 'EXCUSED' }>;
    }
  ): Promise<FacultyAttendanceWorkspaceData> {
    const res = await axios.post(
      `${API_BASE_URL}/faculty/attendance/${assignmentId}`,
      payload,
      getAuthHeaders()
    );
    return res.data.data;
  },


  /**
   * Fetches assignment-scoped analytics
   */
  async getAnalytics(academicYear?: string): Promise<FacultyAnalyticsData> {
    const params = new URLSearchParams();
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await axios.get(`${API_BASE_URL}/faculty/analytics${qs}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Fetches complete attendance history for an assignment
   */
  async getAttendanceHistory(assignmentId: string): Promise<AttendanceHistoryData> {
    const res = await axios.get(`${API_BASE_URL}/faculty/attendance/history/${assignmentId}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Fetches date-wise complete scheduled, completed, and cancelled attendance history
   */
  async getCompleteAttendanceHistory(assignmentId: string): Promise<CompleteAttendanceData> {
    const res = await axios.get(`${API_BASE_URL}/faculty/attendance/complete-history/${assignmentId}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Schedules a class session (Pending status)
   */
  async scheduleClassSession(
    assignmentId: string,
    payload: {
      date: string;
      startTime?: string;
      endTime?: string;
      classroom?: string;
    }
  ): Promise<any> {
    const res = await axios.post(
      `${API_BASE_URL}/faculty/attendance/schedule-session/${assignmentId}`,
      payload,
      getAuthHeaders()
    );
    return res.data.data;
  },

  /**
   * Explicitly marks a scheduled class session as Cancelled
   */
  async cancelClassSession(sessionId: string, reason: string): Promise<any> {
    const res = await axios.post(
      `${API_BASE_URL}/faculty/attendance/cancel-session/${sessionId}`,
      { reason },
      getAuthHeaders()
    );
    return res.data.data;
  },

  /**
   * Fetches detailed session information with student records for correction workspace
   */
  async getAttendanceSessionDetail(sessionId: string): Promise<AttendanceSessionDetailData> {
    const res = await axios.get(`${API_BASE_URL}/faculty/attendance/session/${sessionId}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Submits attendance correction for a conducted session with audit logging
   */
  async correctAttendance(
    sessionId: string,
    payload: {
      changes: Array<{
        studentId: string;
        newStatus: 'PRESENT' | 'ABSENT' | 'EXCUSED';
        reason: string;
        remarks?: string;
      }>;
    }
  ): Promise<AttendanceSessionDetailData> {
    const res = await axios.post(
      `${API_BASE_URL}/faculty/attendance/session/${sessionId}/correction`,
      payload,
      getAuthHeaders()
    );
    return res.data.data;
  },

  /**
   * Fetches all attendance correction audit logs for an assignment
   */
  async getAttendanceCorrections(assignmentId: string): Promise<AttendanceCorrectionLogItem[]> {
    const res = await axios.get(`${API_BASE_URL}/faculty/attendance/corrections/${assignmentId}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Searches students authorized under current faculty's active teaching assignments
   */
  async searchStudents(query: string, academicYear?: string, semester?: string): Promise<FacultyStudentSearchResult[]> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);
    if (semester && semester !== 'ALL') params.append('semester', semester);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await axios.get(`${API_BASE_URL}/faculty/attendance/students/search${qs}`, getAuthHeaders());
    return res.data.data || [];
  },

  /**
   * Retrieves student details and attendance strictly for subjects taught by current faculty
   */
  async getStudentAttendance(studentId: string, academicYear?: string): Promise<FacultyStudentAttendanceData> {
    const params = new URLSearchParams();
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await axios.get(`${API_BASE_URL}/faculty/attendance/students/${studentId}${qs}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Retrieves all authorized cohorts for All Subject Attendance
   */
  async getAllSubjectAttendanceCohorts(): Promise<{
    academicYears: string[];
    cohorts: FacultyAllSubjectCohort[];
  }> {
    const res = await axios.get(`${API_BASE_URL}/faculty/all-subject-attendance/cohorts`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Retrieves the live consolidated attendance register for an authorized cohort
   */
  async getAllSubjectAttendanceRegister(params: {
    academicYear: string;
    semester: number;
    departmentId: string;
    section?: string;
  }): Promise<FacultyConsolidatedAttendanceData> {
    const q = new URLSearchParams();
    q.append('academicYear', params.academicYear);
    q.append('semester', String(params.semester));
    q.append('departmentId', params.departmentId);
    if (params.section && params.section !== 'ALL') {
      q.append('section', params.section);
    }
    const res = await axios.get(
      `${API_BASE_URL}/faculty/all-subject-attendance/register?${q.toString()}`,
      getAuthHeaders()
    );
    return res.data.data;
  },

  /**
   * Returns download URL for Consolidated All Subject Attendance Excel
   */
  downloadAllSubjectAttendanceExcelUrl(params: {
    academicYear: string;
    semester: number;
    departmentId: string;
    section?: string;
  }): string {
    const q = new URLSearchParams();
    q.append('academicYear', params.academicYear);
    q.append('semester', String(params.semester));
    q.append('departmentId', params.departmentId);
    if (params.section && params.section !== 'ALL') {
      q.append('section', params.section);
    }
    const token = localStorage.getItem('token');
    if (token) q.append('token', token);
    return `${API_BASE_URL}/faculty/all-subject-attendance/export?${q.toString()}`;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // BITWISE MARKS ENTRY MODULE APIs
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * PAGE 1: Retrieves assigned semesters for faculty with real progress cards
   */
  async getBitwiseSemesters(academicYear?: string): Promise<BitwiseSemesterCard[]> {
    const params = new URLSearchParams();
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await axios.get(`${API_BASE_URL}/faculty/marks/semesters${qs}`, getAuthHeaders());
    return res.data.data || [];
  },

  /**
   * PAGE 2: Retrieves assigned subjects in a semester
   */
  async getBitwiseSubjectsForSemester(semester: number, academicYear?: string): Promise<BitwiseSubjectItem[]> {
    const params = new URLSearchParams();
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await axios.get(`${API_BASE_URL}/faculty/marks/semesters/${semester}/subjects${qs}`, getAuthHeaders());
    return res.data.data || [];
  },

  /**
   * PAGE 3: Retrieves assessment configuration (CIE-1 or CIE-2)
   */
  async getAssessmentConfig(
    subjectId: string,
    semester: number,
    assessmentType: 'CIE1' | 'CIE2',
    academicYear?: string
  ): Promise<AssessmentConfigData> {
    const params = new URLSearchParams();
    params.append('subjectId', subjectId);
    params.append('semester', String(semester));
    params.append('assessmentType', assessmentType);
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);

    const res = await axios.get(`${API_BASE_URL}/faculty/marks/config?${params.toString()}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * PAGE 3: Saves/Updates assessment question pattern configuration
   */
  async saveAssessmentConfig(payload: {
    subjectId: string;
    semester: number;
    assessmentType: 'CIE1' | 'CIE2';
    maximumMarks: number;
    questionPattern: MainQuestionDef[];
    attemptRules: AttemptRulesDef;
    confirmIncompatibleChange?: boolean;
    academicYear?: string;
  }): Promise<{ success?: boolean; requiresConfirmation?: boolean; message?: string; data?: any }> {
    const res = await axios.post(`${API_BASE_URL}/faculty/marks/config`, payload, getAuthHeaders());
    return res.data;
  },

  /**
   * PAGE 4: Retrieves Question-wise Marks Entry Grid
   */
  async getBitwiseMarksWorkspace(
    subjectId: string,
    semester: number,
    assessmentType: 'CIE1' | 'CIE2',
    academicYear?: string
  ): Promise<BitwiseMarksWorkspaceData> {
    const params = new URLSearchParams();
    params.append('subjectId', subjectId);
    params.append('semester', String(semester));
    params.append('assessmentType', assessmentType);
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);

    const res = await axios.get(`${API_BASE_URL}/faculty/marks/workspace?${params.toString()}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * PAGE 4: Saves Question-wise Marks (Draft or Final)
   */
  async saveBitwiseMarks(payload: {
    subjectId: string;
    semester: number;
    assessmentType: 'CIE1' | 'CIE2';
    marks: Array<{
      studentId: string;
      questionId: string;
      subquestionId: string;
      marksObtained: number | string | null;
    }>;
    isDraft?: boolean;
    academicYear?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await axios.post(`${API_BASE_URL}/faculty/marks/save`, payload, getAuthHeaders());
    return res.data;
  },

  /**
   * PAGE 5: Retrieves Assignment Workspace
   */
  async getAssignmentWorkspace(
    subjectId: string,
    semester: number,
    academicYear?: string
  ): Promise<AssignmentWorkspaceData> {
    const params = new URLSearchParams();
    params.append('subjectId', subjectId);
    params.append('semester', String(semester));
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);

    const res = await axios.get(`${API_BASE_URL}/faculty/marks/assignments?${params.toString()}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * PAGE 5: Saves Assignment Configuration (Pattern & Components)
   */
  async saveAssignmentConfiguration(payload: {
    subjectId: string;
    semester: number;
    components: AssignmentComponentDef[];
    confirmPatternChange?: boolean;
    academicYear?: string;
  }): Promise<{ success: boolean; message: string; configuration: any }> {
    const res = await axios.post(`${API_BASE_URL}/faculty/marks/assignments/config`, payload, getAuthHeaders());
    return res.data;
  },

  /**
   * PAGE 5: Saves Assignment Marks
   */
  async saveAssignmentMarks(payload: {
    subjectId: string;
    semester: number;
    maximumMarks?: number;
    components?: AssignmentComponentDef[];
    calculationPolicy?: any;
    marks: Array<{
      studentId: string;
      componentId: string;
      marksObtained: number | string | null;
    }>;
    isDraft?: boolean;
    academicYear?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await axios.post(`${API_BASE_URL}/faculty/marks/assignments`, payload, getAuthHeaders());
    return res.data;
  },

  /**
   * PAGE 6: Retrieves Final Internal Marks Sheet
   */
  async getFinalInternalMarksWorkspace(
    subjectId: string,
    semester: number,
    academicYear?: string
  ): Promise<FinalInternalMarksWorkspaceData> {
    const params = new URLSearchParams();
    params.append('subjectId', subjectId);
    params.append('semester', String(semester));
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);

    const res = await axios.get(`${API_BASE_URL}/faculty/marks/final-internal?${params.toString()}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * PAGE 6: Saves or Finalizes Final Internal Marks
   */
  async saveFinalInternalMarks(payload: {
    subjectId: string;
    semester: number;
    finalize?: boolean;
    policy?: any;
    academicYear?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await axios.post(`${API_BASE_URL}/faculty/marks/final-internal`, payload, getAuthHeaders());
    return res.data;
  },

  /**
   * PAGE 7: Retrieves External Examination Marks
   */
  async getExternalMarksWorkspace(
    subjectId: string,
    semester: number,
    academicYear?: string
  ): Promise<ExternalMarksWorkspaceData> {
    const params = new URLSearchParams();
    params.append('subjectId', subjectId);
    params.append('semester', String(semester));
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);

    const res = await axios.get(`${API_BASE_URL}/faculty/marks/external?${params.toString()}`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * PAGE 7: Saves External Examination Marks
   */
  async saveExternalMarks(payload: {
    subjectId: string;
    semester: number;
    maximumMarks?: number;
    marks: Array<{
      studentId: string;
      externalMarks: number | string | null;
    }>;
    academicYear?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await axios.post(`${API_BASE_URL}/faculty/marks/external`, payload, getAuthHeaders());
    return res.data;
  },

  /**
   * Downloads official multi-sheet Bitwise Marks Excel file
   */
  async downloadMarksExcel(subjectId: string, semester: number, academicYear?: string): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('subjectId', subjectId);
    params.append('semester', String(semester));
    if (academicYear && academicYear !== 'ALL') params.append('academicYear', academicYear);

    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_BASE_URL}/faculty/marks/export?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Retries Google Drive synchronization for Bitwise Marks
   */
  async retryDriveSync(subjectId: string, semester: number, academicYear?: string): Promise<{ success: boolean; message: string }> {
    const res = await axios.post(
      `${API_BASE_URL}/faculty/marks/sync-retry`,
      { subjectId, semester, academicYear },
      getAuthHeaders()
    );
    return res.data;
  },

  /**
   * Submits assessment to HOD for review
   */
  async submitAssessmentForHodReview(assessmentId: string): Promise<{ success: boolean; message: string; data?: any }> {
    const res = await axios.post(
      `${API_BASE_URL}/faculty/marks/assessments/${assessmentId}/submit`,
      {},
      getAuthHeaders()
    );
    return res.data;
  },

  /**
   * Gets assessment submission and review workflow status
   */
  async getAssessmentWorkflowStatus(assessmentId: string): Promise<{ success: boolean; data: any }> {
    const res = await axios.get(
      `${API_BASE_URL}/faculty/marks/assessments/${assessmentId}/status`,
      getAuthHeaders()
    );
    return res.data;
  },
};

export interface BitwiseSemesterCard {
  semester: number;
  semesterName: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  academicYear: string;
  assignedSubjectsCount: number;
  configsCompletedCount: number;
  cie1Status: string;
  cie2Status: string;
  assignmentStatus: string;
  finalInternalStatus: string;
}

export interface BitwiseSubjectItem {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  semester: number;
  academicYear: string;
  assignedFaculty: string;
  cie1Status: string;
  cie2Status: string;
  assignmentStatus: string;
  finalInternalStatus: string;
  syncStatus: 'NOT_CONFIGURED' | 'SYNCED' | 'PENDING' | 'ERROR';
}

export interface SubQuestionDef {
  id: string;
  label: string;
  maxMarks: number;
  isOptional?: boolean;
}

export interface MainQuestionDef {
  id: string;
  questionNumber: number;
  label: string;
  maxMarks: number;
  subquestions: SubQuestionDef[];
}

export interface QuestionGroupRule {
  id: string;
  name: string;
  questionIds: string[];
  chooseType: 'BEST_OF_1' | 'BEST_OF_N' | 'COMPULSORY';
  maxMarks: number;
}

export interface AttemptRulesDef {
  type: 'GROUPED_BEST_OF' | 'COMPULSORY_ALL';
  groups?: QuestionGroupRule[];
}

export interface AssessmentConfigData {
  id: string | null;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  semester: number;
  academicYear: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  assessmentType: 'CIE1' | 'CIE2';
  maximumMarks: number;
  questionPattern: MainQuestionDef[];
  attemptRules: AttemptRulesDef;
  configurationVersion: number;
  status: string;
  workflowStatus?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'RETURNED' | 'RESUBMITTED' | 'APPROVED' | 'PUBLISHED';
  hodReviewComment?: string | null;
  assignedHodId?: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  isPublished?: boolean;
  hasExistingMarks: boolean;
  existingMarksCount: number;
}

export interface BitwiseMarksStudentRow {
  serialNumber: number;
  studentId: string;
  usn: string;
  studentName: string;
  section: string;
  marks: Record<string, number | null>;
  rawQuestionTotals: Record<string, number>;
  bestOfDetails: {
    groups?: Array<{
      groupId: string;
      groupName: string;
      candidateQuestions: Array<{ questionId: string; total: number }>;
      selectedQuestionId: string | null;
      selectedMarks: number;
      maxMarks: number;
    }>;
    ungroupedQuestions?: Array<{ questionId: string; total: number; maxMarks: number }>;
  };
  finalCieMarks: number;
  percentage: number;
  completionStatus: 'NOT_STARTED' | 'INCOMPLETE' | 'COMPLETED';
}

export interface BitwiseMarksWorkspaceData {
  configuration: AssessmentConfigData;
  students: BitwiseMarksStudentRow[];
  summary: {
    totalStudents: number;
    studentsWithMarks: number;
    studentsIncomplete: number;
    isSaved: boolean;
    syncStatus: 'NOT_CONFIGURED' | 'SYNCED' | 'PENDING' | 'ERROR';
    lastSyncedAt: string | null;
  };
}

export interface AssignmentComponentDef {
  id: string;
  label: string;
  maxMarks: number;
}

export interface AssignmentWorkspaceData {
  isConfigured: boolean;
  configuration: {
    id: string | null;
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    semester: number;
    academicYear: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    maximumMarks: number;
    components: AssignmentComponentDef[];
    calculationPolicy: any;
    status: string;
  } | null;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  subject?: {
    id: string;
    name: string;
    code: string;
  };
  semester?: number;
  academicYear?: string;
  students: Array<{
    serialNumber: number;
    studentId: string;
    usn: string;
    studentName: string;
    section: string;
    marks: Record<string, number | null>;
    rawTotal: number;
    scaledTotal: number;
    completionStatus: 'INCOMPLETE' | 'COMPLETED';
  }>;
}

export interface FinalInternalMarksWorkspaceData {
  metadata: {
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    semester: number;
    academicYear: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    policy: {
      cieRule: 'AVERAGE' | 'BEST_OF';
      cieWeight: number;
      assignmentWeight: number;
      finalMaxMarks: number;
      scalingFormula: string;
    };
    isFinalized: boolean;
  };
  students: Array<{
    serialNumber: number;
    studentId: string;
    usn: string;
    studentName: string;
    section: string;
    cie1Marks: number | null;
    cie2Marks: number | null;
    cieAverageOrPolicyResult: number | null;
    cieScaled25?: number | null;
    assignmentRawMarks: number | null;
    assignmentScaledMarks: number | null;
    finalInternalMarks: number | null;
    maxFinalMarks: number;
    status: 'INCOMPLETE' | 'READY' | 'FINALIZED';
  }>;
}

export interface ExternalMarksWorkspaceData {
  metadata: {
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    semester: number;
    academicYear: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    subjectType?: string;
    isLabOrPractical?: boolean;
    isInternalFinalized?: boolean;
    defaultMaxMarks: number;
  };
  students: Array<{
    serialNumber: number;
    studentId: string;
    usn: string;
    studentName: string;
    section: string;
    finalInternalMarks?: number | null;
    externalMarks: number | null;
    maximumMarks: number;
    seeScaled50?: number | null;
    totalMarks?: number | null;
    status: string;
    reason?: string;
    ciePassed?: boolean;
    seePassed?: boolean;
    aggregatePassed?: boolean;
  }>;
}

export default facultyService;

