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

export interface StudentProfileData {
  student: {
    id: string;
    name: string;
    usn: string;
    email: string;
    phone: string;
    gender: string;
    dob: string;
    bloodGroup: string;
    category: string;
    caste: string;
    religion: string;
    nationality: string;
    aadhaarNumberMasked: string;
  };
  admission: {
    id: string;
    applicationNumber: string;
    status: string;
    admissionType: string;
    quota: string;
    enrolledAt: string;
    createdAt: string;
  } | null;
  academic: {
    program: string;
    departmentName: string;
    departmentCode: string;
    currentSemester: number;
    section: string;
    academicYear: string;
    previousSchool: string;
    previousBoard: string;
    previousPercentage: string | number;
    rank: string | number;
  };
  contact: {
    studentMobile: string;
    studentEmail: string;
    emergencyContact: string;
  };
  address: {
    permanent: {
      line1: string;
      line2: string;
      city: string;
      district: string;
      state: string;
      pincode: string;
    };
    correspondence: {
      line1: string;
      line2: string;
      city: string;
      district: string;
      state: string;
      pincode: string;
    };
  };
  parent: {
    fatherName: string;
    fatherOccupation: string;
    fatherPhone: string;
    fatherEmail: string;
    motherName: string;
    motherOccupation: string;
    motherPhone: string;
    motherEmail: string;
    guardianName: string;
    guardianPhone: string;
    annualIncome: string;
  };
  personal?: {
    firstName?: string;
    middleName?: string | null;
    lastName?: string;
    fullName?: string;
    dateOfBirth?: string;
    gender?: string;
    caste?: string;
    category?: string;
    religion?: string;
    nationality?: string;
    studiedInKarnataka?: boolean | null;
    areaType?: string;
    aadhaarMasked?: string;
  };
  qualifications?: {
    tenth?: {
      school?: string;
      board?: string;
      passingYear?: string;
      registerNumber?: string;
      marksObtained?: number | null;
      maxMarks?: number | null;
      percentage?: string;
      attempts?: number;
    };
    twelfth?: {
      school?: string;
      board?: string;
      passingYear?: string;
      registerNumber?: string;
      stream?: string;
      percentage?: string;
      physicsMarks?: number | null;
      mathsMarks?: number | null;
      chemistryMarks?: number | null;
    } | null;
    diploma?: {
      university?: string;
      year?: string;
      registerNumber?: string;
      percentage?: string;
    } | null;
    entranceExam?: {
      cetNumber?: string;
      dcetNumber?: string | null;
      cetScore?: number | null;
      cetRank?: string | null;
    };
  };
}

export interface StudentOverviewData {
  student: {
    id: string;
    name: string;
    usn: string;
    email: string;
    department: {
      id: string;
      name: string;
      code: string;
    };
    program: string;
    semester: number;
    section: string;
    academicYear: string;
  };
  attendanceSummary: {
    totalClasses: number;
    attendedClasses: number;
    absentClasses: number;
    excusedClasses: number;
    overallPercentage: number;
    subjects: Array<{
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      totalSessions: number;
      attendedSessions: number;
      absentSessions: number;
      percentage: number;
      status: 'Eligible' | 'Shortage';
    }>;
  };
  publishedMarksSummary: {
    totalAssessmentsPublished: number;
    assessments: Array<{
      id: string;
      assessmentName: string;
      assessmentType: string;
      subjectCode: string;
      subjectName: string;
      semester: number;
      maximumMarks: number;
      marksObtained: number | null;
      percentage: number | null;
      publishedAt: string;
    }>;
  };
  recentAcademicUpdates: Array<{
    type: 'ATTENDANCE' | 'MARKS';
    title: string;
    subjectCode: string;
    timestamp: string;
    details: string;
  }>;
  isAdmissionApplicant?: boolean;
  admissionStatus?: string;
  admissionDashboardUrl?: string;
  applicationNumber?: string;
  notice?: string;
}

export interface StudentSubjectAttendance {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  totalSessions: number;
  attendedSessions: number;
  absentSessions: number;
  percentage: number;
  status: 'Eligible' | 'Shortage';
  semester?: number;
  academicYear?: string;
  releaseStatus?: string;
  conductedClasses?: number;
  attendedClasses?: number;
  absentClasses?: number;
  totalEligibleClasses?: number;
}

export interface StudentAttendanceSessionRecord {
  id: string;
  date: string;
  sessionPeriod: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
}

export interface StudentAttendanceHistoryData {
  totalRecords: number;
  history: StudentAttendanceSessionRecord[];
}

export interface StudentSubjectMarksGroup {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  academicYear: string;
  // Exact 7-column representations
  cie1Marks?: number | null;
  cie2Marks?: number | null;
  assignmentMarks?: number | null;
  finalInternalMarks?: number | null;
  externalMarks?: number | null;
  cie1Display?: string;
  cie2Display?: string;
  assignmentDisplay?: string;
  finalInternalDisplay?: string;
  externalDisplay?: string;
  cie1?: { marksObtained: number; maximumMarks: number } | null;
  cie2?: { marksObtained: number; maximumMarks: number } | null;
  credits?: number;
  status?: string;
  statusLabel?: string;
  assessments: Array<{
    id: string;
    assessmentName: string;
    assessmentType: string;
    maximumMarks: number;
    marksObtained: number | null;
    percentage: number | null;
    isPublished: boolean;
    publishedAt: string | null;
    status: string;
  }>;
}

export interface StudentPublishedMarksResponse {
  semester: number;
  academicYear: string;
  marksBySubject: StudentSubjectMarksGroup[];
  subjects: StudentSubjectMarksGroup[];
  semesters?: Array<{
    semester: number;
    academicYear: string;
    rows: StudentSubjectMarksGroup[];
    subjects: StudentSubjectMarksGroup[];
  }>;
  statusNotice?: string;
}

export const studentService = {
  /**
   * Fetches the authenticated student's academic overview
   */
  async getOverview(): Promise<StudentOverviewData> {
    const res = await axios.get(`${API_BASE_URL}/student/overview`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Fetches subject-wise and overall attendance summary
   */
  async getAttendanceSummary(): Promise<{
    totalClasses: number;
    attendedClasses: number;
    absentClasses: number;
    excusedClasses: number;
    overallPercentage: number;
    subjects: StudentSubjectAttendance[];
  }> {
    const res = await axios.get(`${API_BASE_URL}/student/attendance/summary`, getAuthHeaders());
    return res.data.data;
  },

  /**
   * Fetches day-to-day session attendance history with optional subject filtering
   */
  async getAttendanceHistory(params?: {
    subjectId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StudentAttendanceHistoryData> {
    const res = await axios.get(`${API_BASE_URL}/student/attendance/history`, {
      ...getAuthHeaders(),
      params,
    });
    return res.data.data;
  },

  /**
   * Fetches published marks grouped by subject and semester
   */
  async getPublishedMarks(params?: {
    semester?: number;
    academicYear?: string;
  }): Promise<StudentPublishedMarksResponse> {
    const res = await axios.get(`${API_BASE_URL}/student/marks`, {
      ...getAuthHeaders(),
      params,
    });
    return res.data.data;
  },

  /**
   * Fetches read-only admission profile (strictly no document download links)
   */
  async getProfile(): Promise<StudentProfileData> {
    const res = await axios.get(`${API_BASE_URL}/student/profile`, getAuthHeaders());
    return res.data.data;
  },
};

export default studentService;
