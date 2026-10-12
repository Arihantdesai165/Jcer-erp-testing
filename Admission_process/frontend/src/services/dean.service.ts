import API from './api';

export interface DeanDashboardData {
  academicYear: string;
  stats: {
    departments: number;
    activeHods: number;
    totalFaculty: number;
    pendingRequests: number;
  };
  departmentOverview: Array<{
    id: string;
    name: string;
    code: string;
    hodId?: string | null;
    hodUserId?: string | null;
    hodName: string;
    hodEmail: string | null;
    hodImage: string | null;
    facultyCount: number;
    studentCount: number;
    status: string;
  }>;
  pendingRequests: Array<{
    id: string;
    facultyName: string;
    email: string;
    department: string;
    departmentCode: string;
    subject: string;
    subjectCode: string;
    semester: number;
    section: string;
    academicYear: string;
    designation: string;
    createdBy: string;
    requestedDate: string;
    status: string;
  }>;
}

export interface AcademicYearRecord {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'UPCOMING' | 'ARCHIVED';
  isCurrent: boolean;
  createdAt?: string;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  hod?: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
  } | null;
  facultyCount: number;
  studentCount: number;
  subjectCount: number;
  status: string;
  createdAt: string;
}

export interface SemesterRecord {
  id: string;
  semesterNumber: number;
  semesterName: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
}

export interface SectionRecord {
  id: string;
  departmentId: string;
  department?: { name: string; code: string };
  semester: number;
  academicYear: string;
  name: string;
  capacity: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface SubjectRecord {
  id: string;
  name: string;
  code: string;
  semester: number;
  departmentId: string | null;
  department?: { name: string; code: string };
  credits: number;
  type: 'Theory' | 'Practical' | 'Project' | 'Elective' | 'Seminar';
  status: 'ACTIVE' | 'INACTIVE';
}

export interface HodRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  departmentId: string;
  departmentName?: string;
  departmentCode?: string;
  academicYear: string;
  tenureStartDate: string;
  appointmentOrderNo?: string;
  isActive: boolean;
  status: string;
  createdAt: string;
}

export interface FacultyRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  designation: string;
  status: string;
  userStatus?: string;
  subjects: string;
  academicYear: string;
  joiningDate: string;
  archivedAt?: string | null;
  createdAt: string;
}

export interface ArchivedFacultyRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  designation: string;
  status: 'ARCHIVED';
  joiningDate: string;
  archivedAt: string;
  archivedBy: string;
  archivedByEmail?: string | null;
  totalAssignments: number;
  previousSubjects: string;
  createdAt: string;
}

export interface FacultyProfileResponse {
  faculty: {
    id: string;
    userId: string;
    facultyId?: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    gender?: string | null;
    name: string;
    email: string;
    phone?: string | null;
    profileImage?: string | null;
    designation: string;
    joiningDate: string;
    status: string;
    archivedAt?: string | null;
    archivedBy?: string | null;
    coreDepartment: {
      id: string;
      name: string;
      code: string;
    };
  };
  account: {
    id: string;
    email: string;
    status: string;
    mustChangePassword: boolean;
  };
  teachingAssignments: Array<{
    id: string;
    academicYear: string;
    teachingDepartment: string;
    teachingDepartmentCode: string;
    semester: number;
    subject: string;
    subjectCode: string;
    section: string;
    status: string;
  }>;
  historicalAssignments: Array<{
    id: string;
    academicYear: string;
    teachingDepartment: string;
    teachingDepartmentCode: string;
    semester: number;
    subject: string;
    subjectCode: string;
    section: string;
    status: string;
  }>;
  attendanceHistory: Array<{
    id: string;
    date: string;
    subject: string;
    subjectCode: string;
    section: string;
    semester: number;
    period: number;
    present: number;
    absent: number;
    totalStudents: number;
    status: string;
  }>;
  marksHistory: Array<{
    id: string;
    subject: string;
    subjectCode: string;
    section: string;
    assessment: string;
    maxMarks: number;
    academicYear: string;
    status: string;
  }>;
  auditLogs?: Array<{
    id: string;
    action: string;
    createdAt: string;
    details: any;
  }>;
}

export type FacultyHistoricalProfile = FacultyProfileResponse;

export interface FacultyAuthApprovalDetail {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  decidedByName?: string | null;
  decidedByRole?: string | null;
  decidedAt?: string | null;
  rejectionReason?: string | null;
}

export interface FacultyAuthRequest {
  id: string;
  facultyId: string;
  facultyName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  subjectId?: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  section: string;
  academicYear: string;
  designation: string;
  authority: 'DEAN' | 'PRINCIPAL' | string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  overallStatus?: 'PENDING_APPROVAL' | 'AUTHORIZED' | 'REJECTED' | string;
  displayStatus?: string;
  firstApprovedByName?: string | null;
  firstApprovedRole?: string | null;
  firstApprovedAt?: string | null;
  isFirstApproval?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  rejectionReason?: string | null;
  createdBy: string;
  createdDate: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  deanApproval?: FacultyAuthApprovalDetail | null;
  principalApproval?: FacultyAuthApprovalDetail | null;
}

export interface FacultyAssignmentRecord {
  id: string;
  facultyName: string;
  email: string;
  profileImage?: string;
  departmentName: string;
  departmentCode: string;
  subjectName: string;
  subjectCode: string;
  subjectType: string;
  credits: number;
  semester: number;
  section: string;
  academicYear: string;
  status: string;
}

export interface HodSubjectHandlingRequestRecord {
  id: string;
  hodUserId: string;
  hodUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    profileImage?: string;
  };
  departmentId: string;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  semester: number;
  subjectId: string;
  subject?: {
    id: string;
    name: string;
    code: string;
    credits: number;
    type: string;
    semester: number;
  };
  academicYear: string;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

const deanService = {
  // Dashboard
  getDashboardData: async (): Promise<DeanDashboardData> => {
    const res = await API.get('/dean/dashboard');
    return res.data.data;
  },

  // Academic Years
  getAcademicYears: async (params?: { search?: string; status?: string }): Promise<AcademicYearRecord[]> => {
    const res = await API.get('/dean/academic-years', { params });
    return res.data.data;
  },
  createAcademicYear: async (data: Partial<AcademicYearRecord>): Promise<AcademicYearRecord> => {
    const res = await API.post('/dean/academic-years', data);
    return res.data.data;
  },
  updateAcademicYear: async (id: string, data: Partial<AcademicYearRecord>): Promise<AcademicYearRecord> => {
    const res = await API.put(`/dean/academic-years/${id}`, data);
    return res.data.data;
  },

  // Departments
  getDepartments: async (params?: { search?: string }): Promise<DepartmentRecord[]> => {
    const res = await API.get('/dean/departments', { params });
    return res.data.data;
  },
  createDepartment: async (data: { name: string; code: string }): Promise<DepartmentRecord> => {
    const res = await API.post('/dean/departments', data);
    return res.data.data;
  },
  updateDepartment: async (id: string, data: { name?: string; code?: string }): Promise<DepartmentRecord> => {
    const res = await API.put(`/dean/departments/${id}`, data);
    return res.data.data;
  },
  getDepartmentAcademicInfo: async (id: string): Promise<any> => {
    const res = await API.get(`/dean/departments/${id}/academic-info`);
    return res.data.data;
  },

  // Semesters
  getSemesters: async (params?: { academicYear?: string }): Promise<SemesterRecord[]> => {
    const res = await API.get('/dean/semesters', { params });
    return res.data.data;
  },
  createSemester: async (data: Partial<SemesterRecord>): Promise<SemesterRecord> => {
    const res = await API.post('/dean/semesters', data);
    return res.data.data;
  },
  updateSemester: async (id: string, data: Partial<SemesterRecord>): Promise<SemesterRecord> => {
    const res = await API.put(`/dean/semesters/${id}`, data);
    return res.data.data;
  },

  // Sections
  getSections: async (params?: { departmentId?: string; semester?: number; academicYear?: string }): Promise<SectionRecord[]> => {
    const res = await API.get('/dean/sections', { params });
    return res.data.data;
  },
  createSection: async (data: Partial<SectionRecord>): Promise<SectionRecord> => {
    const res = await API.post('/dean/sections', data);
    return res.data.data;
  },
  updateSection: async (id: string, data: Partial<SectionRecord>): Promise<SectionRecord> => {
    const res = await API.put(`/dean/sections/${id}`, data);
    return res.data.data;
  },

  // Subjects
  getSubjects: async (params?: { search?: string; departmentId?: string; semester?: number; type?: string }): Promise<SubjectRecord[]> => {
    const res = await API.get('/dean/subjects', { params });
    return res.data.data;
  },
  createSubject: async (data: Partial<SubjectRecord>): Promise<SubjectRecord> => {
    const res = await API.post('/dean/subjects', data);
    return res.data.data;
  },
  updateSubject: async (id: string, data: Partial<SubjectRecord>): Promise<SubjectRecord> => {
    const res = await API.put(`/dean/subjects/${id}`, data);
    return res.data.data;
  },

  // HODs
  getHods: async (params?: { search?: string; departmentId?: string; status?: string }): Promise<HodRecord[]> => {
    const res = await API.get('/dean/hods', { params });
    return res.data.data;
  },
  createHod: async (data: any): Promise<any> => {
    const res = await API.post('/dean/hods', data);
    return res.data;
  },
  getHodById: async (id: string): Promise<any> => {
    const res = await API.get(`/dean/hods/${id}`);
    return res.data.data;
  },
  assignHod: async (data: { hodUserId: string; departmentId: string; academicYear: string; startDate: string; endDate?: string }): Promise<any> => {
    const res = await API.post('/dean/hods/assign', data);
    return res.data;
  },
  getHodHistory: async (): Promise<any[]> => {
    const res = await API.get('/dean/hods/history');
    return res.data.data;
  },
  deleteHod: async (id: string): Promise<any> => {
    const res = await API.delete(`/dean/hods/${id}`);
    return res.data;
  },

  // Faculty Management & Authorizations
  getFacultyList: async (params?: { search?: string; departmentId?: string; status?: string }): Promise<FacultyRecord[]> => {
    const res = await API.get('/dean/faculty', { params });
    return res.data.data;
  },
  getFacultyAuthorizations: async (params?: { search?: string; departmentId?: string; status?: string; academicYear?: string }): Promise<FacultyAuthRequest[]> => {
    const res = await API.get('/dean/faculty/authorizations', { params });
    return res.data.data;
  },
  getFacultyAuthorizationNotificationCount: async (): Promise<{ count: number }> => {
    const res = await API.get('/dean/faculty-authorizations/notification-count');
    return res.data;
  },
  getFacultyAuthorizationById: async (id: string): Promise<any> => {
    const res = await API.get(`/dean/faculty/authorizations/${id}`);
    return res.data.data;
  },
  approveFacultyAuthorization: async (id: string): Promise<any> => {
    const res = await API.post(`/dean/faculty/authorizations/${id}/approve`);
    return res.data;
  },
  rejectFacultyAuthorization: async (id: string, reason: string): Promise<any> => {
    const res = await API.post(`/dean/faculty/authorizations/${id}/reject`, { reason });
    return res.data;
  },
  getFacultyAssignments: async (params?: { search?: string; departmentId?: string; semester?: number; academicYear?: string; status?: string }): Promise<FacultyAssignmentRecord[]> => {
    const res = await API.get('/dean/faculty/assignments', { params });
    return res.data.data;
  },

  createFaculty: async (payload: {
    firstName: string;
    middleName?: string;
    lastName: string;
    gender?: string;
    email: string;
    phone?: string;
    designation: string;
    joiningDate?: string;
    coreDepartmentId: string;
  }): Promise<any> => {
    const res = await API.post('/dean/faculty', payload);
    return res.data;
  },

  downloadBulkFacultyTemplate: async (): Promise<Blob> => {
    const res = await API.get('/dean/faculty/template', {
      responseType: 'blob',
    });
    return res.data;
  },

  validateBulkFaculty: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await API.post('/dean/faculty/bulk-validate', formData);
    return res.data;
  },

  importBulkFaculty: async (records: any[]): Promise<any> => {
    const res = await API.post('/dean/faculty/bulk-import', { records });
    return res.data;
  },

  getArchivedFacultyList: async (params?: { search?: string; departmentId?: string }): Promise<ArchivedFacultyRecord[]> => {
    const res = await API.get('/dean/faculty/archived', { params });
    return res.data.data;
  },

  getFacultyProfile: async (id: string): Promise<FacultyProfileResponse> => {
    const res = await API.get(`/dean/faculty/${id}`);
    return res.data.data;
  },

  getFacultyHistory: async (id: string): Promise<FacultyProfileResponse> => {
    const res = await API.get(`/dean/faculty/${id}/history`);
    return res.data.data;
  },

  regenerateFacultyPassword: async (id: string): Promise<{ facultyName: string; loginEmail: string; temporaryPassword: string }> => {
    const res = await API.post(`/dean/faculty/${id}/regenerate-password`);
    return res.data.data;
  },

  archiveFaculty: async (id: string): Promise<any> => {
    const res = await API.delete(`/dean/faculty/${id}`);
    return res.data;
  },

  restoreFaculty: async (id: string): Promise<any> => {
    const res = await API.post(`/dean/faculty/${id}/restore`);
    return res.data;
  },

  // HOD Subject Handling Requests
  getHodSubjectRequests: async (params?: {
    search?: string;
    departmentId?: string;
    status?: string;
    academicYear?: string;
    semester?: number | string;
  }): Promise<HodSubjectHandlingRequestRecord[]> => {
    const res = await API.get('/dean/hod-subject-requests', { params });
    return res.data.data;
  },
  getHodSubjectRequestCount: async (): Promise<{ count: number }> => {
    const res = await API.get('/dean/hod-subject-requests/count');
    return res.data;
  },
  getHodSubjectRequestById: async (id: string): Promise<HodSubjectHandlingRequestRecord> => {
    const res = await API.get(`/dean/hod-subject-requests/${id}`);
    return res.data.data;
  },
  approveHodSubjectRequest: async (id: string): Promise<any> => {
    const res = await API.post(`/dean/hod-subject-requests/${id}/approve`);
    return res.data;
  },
  rejectHodSubjectRequest: async (id: string, rejectionReason: string): Promise<any> => {
    const res = await API.post(`/dean/hod-subject-requests/${id}/reject`, { rejectionReason });
    return res.data;
  },
};

export default deanService;
