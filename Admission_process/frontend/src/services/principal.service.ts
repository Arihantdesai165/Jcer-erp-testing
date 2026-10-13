import API from './api';

export interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  description?: string;
  status?: string;
}

export interface AcademicYearRecord {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  status: string;
  isCurrent: boolean;
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
  deanApproval?: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
    decidedByName?: string | null;
    decidedByRole?: string | null;
    decidedAt?: string | null;
    rejectionReason?: string | null;
  } | null;
  principalApproval?: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
    decidedByName?: string | null;
    decidedByRole?: string | null;
    decidedAt?: string | null;
    rejectionReason?: string | null;
  } | null;
}

export interface FacultyAssignmentDetail {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectType: string;
  credits: number;
  semester: number;
  section: string;
  academicYear: string;
  attendanceAccess: boolean;
  marksAccess: boolean;
  status: string;
}

export interface FacultyAuthDetailResponse extends Omit<FacultyAuthRequest, 'decidedBy'> {
  assignments: FacultyAssignmentDetail[];
  assignmentsData?: any[];
  faculty?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    profileImage?: string;
    status: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
  };
  subject?: {
    id: string;
    name: string;
    code: string;
    credits?: number;
    type?: string;
  };
  createdByHOD?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImage?: string;
  };
  decidedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

const principalService = {
  // Faculty Authorization Requests
  getFacultyAuthorizations: async (params?: {
    search?: string;
    departmentId?: string;
    status?: string;
    academicYear?: string;
    authority?: string;
  }): Promise<FacultyAuthRequest[]> => {
    const res = await API.get('/principal/faculty/authorizations', { params });
    return res.data.data;
  },

  getFacultyAuthorizationById: async (id: string): Promise<FacultyAuthDetailResponse> => {
    const res = await API.get(`/principal/faculty/authorizations/${id}`);
    return res.data.data;
  },

  getFacultyAuthorizationNotificationCount: async (): Promise<{
    count: number;
    principalPendingCount?: number;
    totalPendingCount?: number;
  }> => {
    const res = await API.get('/principal/faculty/authorizations/count');
    return res.data;
  },

  approveFacultyAuthorization: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await API.post(`/principal/faculty/authorizations/${id}/approve`);
    return res.data;
  },

  rejectFacultyAuthorization: async (id: string, reason: string): Promise<{ success: boolean; message: string }> => {
    const res = await API.post(`/principal/faculty/authorizations/${id}/reject`, { reason });
    return res.data;
  },

  // Supporting filter options
  getDepartments: async (): Promise<DepartmentRecord[]> => {
    const res = await API.get('/principal/departments');
    return res.data.data;
  },

  getAcademicYears: async (): Promise<AcademicYearRecord[]> => {
    const res = await API.get('/principal/academic-years');
    return res.data.data;
  },

  getFacultyList: async (params?: { search?: string; departmentId?: string; status?: string }): Promise<any[]> => {
    const res = await API.get('/principal/faculty', { params });
    return res.data.data;
  },

  // Teaching Profile
  getTeachingProfile: async (): Promise<TeachingProfileData> => {
    const res = await API.get('/principal/teaching-profile');
    return res.data.data;
  },

  updateTeachingProfile: async (data: { coreDepartmentId: string }): Promise<any> => {
    const res = await API.put('/principal/teaching-profile', data);
    return res.data;
  },
};

export interface TeachingProfileAssignment {
  id: string;
  subjectName?: string;
  subjectCode?: string;
  semester?: number;
  academicYear?: string;
  section?: string;
  assignedAt?: string;
  teachingDepartment?: {
    name: string;
    code: string;
  } | null;
}

export interface TeachingProfileData {
  userId: string;
  role: string;
  fullName: string;
  email: string;
  coreDepartmentId: string | null;
  coreDepartment: {
    id: string;
    name: string;
    code: string;
  } | null;
  isTeachingEligible: boolean;
  teacherStatus: string | null;
  activeAssignments: TeachingProfileAssignment[];
}

export default principalService;
