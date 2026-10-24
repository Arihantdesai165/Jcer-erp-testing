import API from './api';

export interface HodDashboardStats {
  totalStudents: number;
  totalFaculty: number;
  totalSubjects: number;
  activeSections: number;
  overallAttendance: number;
  averageMarks: number;
  attendanceDefaulters: number;
  pendingFacultyActions: number;
}

export interface PendingAuthorizationItem {
  id: string;
  facultyName: string;
  email: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  section: string;
  authority: 'DEAN' | 'PRINCIPAL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface RecentAssignmentItem {
  id: string;
  facultyName: string;
  email: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  section: string;
  attendanceAccess: boolean;
  marksAccess: boolean;
}

export interface HodDashboardData {
  hod: {
    id?: string;
    userId?: string;
    name: string;
    email: string;
    phone?: string;
    profileImage?: string;
    role?: string;
  };
  department: {
    id: string;
    name: string;
    code: string;
    type?: 'STANDARD' | 'SEMESTER_HANDLING';
    handlingSemesters?: number[] | null;
  } | null;
  academicYear: string;
  stats: HodDashboardStats;
  branchBreakdown?: Array<{
    branchCode: string;
    branchName: string;
    departmentId: string;
    sem1Count: number;
    sem2Count: number;
    totalStudents: number;
    allocatedStudents: number;
    unallocatedStudents: number;
  }>;
  pendingAuthorizationsList: PendingAuthorizationItem[];
  recentAssignments: RecentAssignmentItem[];
  attendanceAnalytics: {
    overallPercentage: number;
    semesterBreakdown: Array<{ semester: number; attendance: number }>;
    monthlyTrend: Array<{ month: string; percentage: number }>;
  };
  marksAnalytics: {
    averageMarks: number;
    passPercentage: number;
    failPercentage: number;
    highestMarks: number;
    lowestMarks: number;
    bitwiseSummary: Array<{ name: string; average: number; maxMarks: number }>;
  };
}

export interface HodDepartmentInfo {
  department: {
    id: string;
    name: string;
    code: string;
    type?: 'STANDARD' | 'SEMESTER_HANDLING';
    handlingSemesters?: number[] | null;
  };
  facultyList: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    phone?: string;
    designation: string;
    joiningDate?: string;
    status: string;
  }>;
  subjectsList: Array<{
    id: string;
    code: string;
    name: string;
    semester: number;
    credits: number;
    type: string;
    status: string;
  }>;
}

export interface HodStudentItem {
  id: string;
  slNo?: number;
  userId: string;
  usn: string | null;
  enrollmentNumber: string | null;
  applicationNumber?: string | null;
  name: string;
  email: string;
  phone: string;
  semester: number;
  branch?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  actualBranch?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  section: string | null;
  batchYear: number;
  batch?: string;
  batchCohort?: string;
  admissionBatch?: string | null;
  academicYear?: string;
  currentAcademicYear?: string;
  admissionStatus: string;
  admissionType: string;
  qualification?: string | null;
  gender?: string | null;
  category?: string | null;
  profileImage?: string;
  attendancePercentage: number | null;
  isDefaulter: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface HodSectionItem {
  id: string;
  code?: string;
  name: string;
  branch?: string | null;
  semester: number;
  academicYear: string;
  capacity: number;
  maxCapacity?: number;
  classroom?: string | null;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  studentCount: number;
  availableCapacity: number;
  fillPercentage: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface HodSectionStudentItem {
  id: string;
  userId: string;
  usn: string | null;
  enrollmentNumber: string | null;
  rollNumber: string | null;
  name: string;
  email: string;
  phone: string;
  semester: number;
  sectionId?: string | null;
  section?: {
    id: string;
    code: string;
    name: string;
  } | string | null;
  currentSectionCode?: string;
  currentSectionId?: string | null;
  currentSection?: string | null;
  admissionType: string;
  admissionStatus: string;
  gender?: string | null;
  category?: string | null;
  isAllocatedToThisSection?: boolean;
  isAllocatedToOtherSection?: boolean;
  isUnallocated?: boolean;
}

export interface HodBranchOverviewItem {
  branchCode: string;
  branchName: string;
  departmentId: string;
  totalStudents: number;
  sectionCount: number;
  allocatedStudents: number;
  unallocatedStudents: number;
}

export interface HodBranchesOverviewPayload {
  semester: number;
  academicYear: string;
  department: { id: string; name: string; code: string; type?: string };
  branches: HodBranchOverviewItem[];
}

export interface HodSectionCohortData {
  section: HodSectionItem;
  siblingSections: Array<{ id: string; name: string; capacity: number; code?: string }>;
  stats: {
    totalStudents?: number;
    totalDepartmentStudents?: number;
    allocatedStudents?: number;
    unallocatedStudents?: number;
    thisSectionAllocated?: number;
    otherSectionsAllocated?: number;
    sectionCapacity?: number;
    sectionAllocatedCount?: number;
    remainingCapacity?: number;
    fillPercentage?: number;
  };
  students: HodSectionStudentItem[];
}

export interface HodCohortStudentItem {
  id: string;
  index: number;
  usn: string | null;
  enrollmentNumber: string | null;
  applicationNumber: string | null;
  name: string;
  email: string | null;
  department: string;
  semester: number;
  section: string;
  rollNumber: string | null;
  academicYear: string;
  status: string;
  admissionType: string;
}

export interface HodCohortSubjectItem {
  id: string;
  name: string;
  code: string;
  type: string;
  category?: string;
  credits: number;
  semester: number;
  cycle?: 'P_CYCLE' | 'C_CYCLE' | string | null;
  schemeId?: string;
  isAssigned?: boolean;
  assignmentStatus?: 'ASSIGNED' | 'NOT_ASSIGNED';
}

export interface HodCohortFacultyAssignment {
  userId: string;
  facultyName: string;
  facultyEmail: string | null;
  cycle: string | null;
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    cycle: string | null;
    section: string;
    type: string;
  }>;
  sections: string[];
}

export interface HodSemesterCohortPayload {
  semester: number;
  academicYear: string;
  department: {
    id: string;
    name: string;
    code: string;
    type?: string;
  };
  // New enriched stats from backend
  stats?: {
    totalStudents: number;
    activeStudents: number;
    allocatedCount: number;
    unallocatedCount: number;
    totalSections: number;
    totalSubjects: number;
    totalFaculty: number;
    sections: string;
    sectionsList: string[];
    sectionsBreakdown: Array<{ section: string; count: number }>;
  };
  // Legacy summary shape (kept for backward compat)
  summary?: {
    totalStudents: number;
    activeStudents: number;
    sections: string;
    sectionsList: string[];
    sectionsBreakdown: Array<{ section: string; count: number }>;
  };
  sectionsBreakdown?: Array<{ section: string; count: number }>;
  students: HodCohortStudentItem[];
  subjects: HodCohortSubjectItem[];
  facultyAssignments?: HodCohortFacultyAssignment[];
}

export interface HodFacultyApprovalRecord {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LOCKED' | string;
  approvedByName?: string | null;
  decidedByName?: string | null;
  approvedByRole?: string | null;
  decidedByRole?: string | null;
  approvedAt?: string | null;
  decidedAt?: string | null;
  rejectionReason?: string | null;
}

export interface HodFacultyItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  designation: string;
  department?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  coreDepartmentId?: string | null;
  coreDepartmentName?: string | null;
  coreDepartmentCode?: string | null;
  isCoreDepartment?: boolean;
  cycle?: 'P_CYCLE' | 'C_CYCLE' | string | null;
  joiningDate?: string;
  accountStatus: string; // 'ACTIVE' | 'INACTIVE' | 'PENDING_AUTHORIZATION'
  authorizationStatus: 'PENDING_DEAN' | 'PENDING_PRINCIPAL' | 'FULLY_APPROVED' | 'REJECTED' | 'PENDING' | 'APPROVED' | string;
  approvalSummary?: string;
  authority?: 'DEAN' | 'PRINCIPAL' | 'DEAN_ACADEMICS' | string;
  rejectedByName?: string | null;
  rejectionReason?: string | null;
  profileImage?: string;
  assignedSubjectsCount?: number;
  totalActiveAssignmentsCount?: number;
  deanApproval?: HodFacultyApprovalRecord | null;
  principalApproval?: HodFacultyApprovalRecord | null;
  assignments: Array<{
    id: string;
    subjectId: string;
    subjectName?: string;
    subjectCode?: string;
    subjectCycle?: string | null;
    cycle?: string | null;
    subjectSchemeId?: string;
    credits?: number;
    semester: number;
    section: string;
    academicYear?: string;
    attendanceAccess?: boolean;
    marksAccess?: boolean;
    status: string;
  }>;
  hodAssignments?: Array<{
    id: string;
    subjectId: string;
    subjectName?: string;
    subjectCode?: string;
    subjectCycle?: string | null;
    credits?: number;
    semester: number;
    section: string;
    academicYear?: string;
    departmentId?: string;
    departmentCode?: string;
    departmentName?: string;
    status: string;
  }>;
  allActiveAssignments?: Array<{
    id: string;
    subjectId: string;
    subjectName?: string;
    subjectCode?: string;
    subjectCycle?: string | null;
    credits?: number;
    semester: number;
    section: string;
    academicYear?: string;
    departmentId?: string;
    departmentCode?: string;
    departmentName?: string;
    status: string;
  }>;
  authorizationHistory?: any[];
}

export interface CourseCategoryDefinition {
  code: string;
  name: string;
  label: string;
}

export const APPLIED_SCIENCE_COURSE_CATEGORIES: CourseCategoryDefinition[] = [
  { code: 'ASC', name: 'Applied Science Course', label: 'ASC — Applied Science Course' },
  { code: 'IPCC', name: 'Integrated Professional Core Course', label: 'IPCC — Integrated Professional Core Course' },
  { code: 'PCC', name: 'Professional Core Course', label: 'PCC — Professional Core Course' },
  { code: 'PCCL', name: 'Professional Core Course Laboratory', label: 'PCCL — Professional Core Course Laboratory' },
  { code: 'ESC', name: 'Engineering Science Course', label: 'ESC — Engineering Science Course' },
  { code: 'ETC', name: 'Emerging Technology Course', label: 'ETC — Emerging Technology Course' },
  { code: 'AEC', name: 'Ability Enhancement Course', label: 'AEC — Ability Enhancement Course' },
  { code: 'SDC', name: 'Skill Development / Project Course', label: 'SDC — Skill Development / Project Course' },
  { code: 'NCMC', name: 'Non-Credit Mandatory Course', label: 'NCMC — Non-Credit Mandatory Course' },
];

export interface HodSubjectItem {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  type: string;
  category?: string;
  cycle?: 'P_CYCLE' | 'C_CYCLE' | string | null;
  schemeId?: string;
  scheme?: { id?: string; name?: string; code?: string } | any;
  status: string;
  assignedFaculty: Array<{
    assignmentId: string;
    facultyName: string;
    semester: number;
    section: string;
    attendanceAccess: boolean;
    marksAccess: boolean;
  }>;
}

export interface HodDepartmentSchemeData {
  activeSchemeId: string | null;
  activeSchemeName: string | null;
  departmentCode: string;
  departmentName: string;
  type?: string;
  handlingSemesters?: number[] | null;
}

export interface HodTeachingAssignment {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  section: string;
  academicYear: string;
  assignmentType: string;
  status: string;
  attendanceAccess: boolean;
  marksAccess: boolean;
  assignedAt: string;
}

export interface HodSubjectHandlingRequestItem {
  id: string;
  hodUserId: string;
  departmentId: string;
  departmentName?: string;
  departmentCode?: string;
  semester: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  academicYear: string;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface HodAvailableSubject {
  id: string;
  name: string;
  code: string;
  semester: number;
  credits: number;
  type: string;
  departmentId: string | null;
  departmentName: string;
  departmentCode: string;
  isAlreadyAssigned: boolean;
  hasPendingRequest: boolean;
}

export interface HodTeachingResponsibilitiesData {
  activeAssignments: HodTeachingAssignment[];
  totalSubjectsCount: number;
  myRequests: HodSubjectHandlingRequestItem[];
  academicYear: string;
}

export interface HodDefaulterItem {
  id: string;
  name: string;
  usn: string;
  semester: number;
  section: string;
  totalSessions: number;
  presentSessions: number;
  attendancePercentage: number;
  deficit: number;
  parentPhone: string;
  parentEmail: string;
}

export interface HodPerformanceItem {
  id: string;
  name: string;
  usn: string;
  semester: number;
  section: string;
  attendancePercentage: number;
  averageMarks: number;
  passFail: 'PASS' | 'FAIL';
  bitwiseScores: {
    bit1: number;
    bit2: number;
    bit3: number;
    bit4: number;
    bit5: number;
  };
}

export interface TeachingAssignmentInput {
  semester: number | string;
  subjectName: string;
  subjectCode: string;
  academicYear?: string;
  section?: string;
  permissions?: {
    attendance: boolean;
    marks: boolean;
  };
  attendanceAccess?: boolean;
  marksAccess?: boolean;
}

export const hodService = {
  // 1. Dashboard
  getDashboardData: async (params?: {
    academicYear?: string;
    semester?: string | number;
    section?: string;
    branch?: string;
  }): Promise<HodDashboardData> => {
    const res = await API.get('/hod/dashboard', { params });
    return res.data.data;
  },

  getDepartmentInfo: async (): Promise<HodDepartmentInfo> => {
    const res = await API.get('/hod/department');
    return res.data.data;
  },

  // 2. Students
  getStudents: async (params?: {
    page?: number;
    limit?: number;
    semester?: string | number;
    section?: string;
    branch?: string;
    status?: string;
    admissionType?: string;
    qualification?: string;
    gender?: string;
    category?: string;
    district?: string;
    academicYear?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ students: HodStudentItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> => {
    const res = await API.get('/hod/students', { params });
    return res.data.data;
  },

  getStudentById: async (id: string): Promise<any> => {
    const res = await API.get(`/hod/students/${id}`);
    return res.data.data;
  },

  getStudentSemesters: async (academicYear?: string): Promise<Array<{ semester: number; totalStudents: number; assignedSectionsCount: number }>> => {
    const res = await API.get('/hod/students/semesters', { params: { academicYear } });
    return res.data.data;
  },

  getBranchesOverview: async (
    semester?: number | string,
    academicYear?: string
  ): Promise<HodBranchesOverviewPayload> => {
    try {
      const res = await API.get('/hod/sections/branches-overview', { params: { semester, academicYear } });
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.get('/hod/students/sections/branches-overview', { params: { semester, academicYear } });
        return fallback.data.data;
      }
      throw err;
    }
  },

  getStudentSections: async (semester?: number | string, academicYear?: string, branch?: string): Promise<HodSectionItem[]> => {
    try {
      const res = await API.get('/hod/students/sections', { params: { semester, academicYear, branch } });
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.get('/hod/sections', { params: { semester, academicYear, branch } });
        return fallback.data.data;
      }
      throw err;
    }
  },

  getSections: async (semester?: number | string, academicYear?: string, branch?: string): Promise<HodSectionItem[]> => {
    try {
      const res = await API.get('/hod/students/sections', { params: { semester, academicYear, branch } });
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.get('/hod/sections', { params: { semester, academicYear, branch } });
        return fallback.data.data;
      }
      throw err;
    }
  },

  getSectionById: async (sectionId: string): Promise<HodSectionItem> => {
    try {
      const res = await API.get(`/hod/students/sections/${sectionId}`);
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.get(`/hod/sections/${sectionId}`);
        return fallback.data.data;
      }
      throw err;
    }
  },

  createSection: async (data: {
    name: string;
    semester: number;
    capacity: number;
    branch?: string;
    academicYear?: string;
    classroom?: string;
    description?: string;
  }): Promise<HodSectionItem> => {
    try {
      const res = await API.post('/hod/students/sections', data);
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.post('/hod/sections', data);
        return fallback.data.data;
      }
      throw err;
    }
  },

  updateSection: async (
    sectionId: string,
    data: Partial<{ name: string; capacity: number; classroom: string; description: string; status: 'ACTIVE' | 'INACTIVE' }>
  ): Promise<HodSectionItem> => {
    try {
      const res = await API.put(`/hod/students/sections/${sectionId}`, data);
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.put(`/hod/sections/${sectionId}`, data);
        return fallback.data.data;
      }
      throw err;
    }
  },

  deleteSection: async (sectionId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await API.delete(`/hod/students/sections/${sectionId}`);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.delete(`/hod/sections/${sectionId}`);
        return fallback.data;
      }
      throw err;
    }
  },

  getSectionStudents: async (sectionId: string): Promise<{ section: HodSectionItem; students: HodSectionStudentItem[] }> => {
    try {
      const res = await API.get(`/hod/students/sections/${sectionId}/students`);
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.get(`/hod/sections/${sectionId}/students`);
        return fallback.data.data;
      }
      throw err;
    }
  },

  getSectionCohort: async (sectionId: string): Promise<HodSectionCohortData> => {
    try {
      const res = await API.get(`/hod/students/sections/${sectionId}/cohort`);
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.get(`/hod/sections/${sectionId}/cohort`);
        return fallback.data.data;
      }
      throw err;
    }
  },

  bulkAllocateStudents: async (
    sectionId: string,
    studentAllocations: Array<{ studentId: string; rollNumber?: string }>
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await API.post(`/hod/students/sections/${sectionId}/bulk-allocate`, { studentAllocations });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.post(`/hod/sections/${sectionId}/bulk-allocate`, { studentAllocations });
        return fallback.data;
      }
      throw err;
    }
  },

  allocateStudents: async (
    sectionId: string,
    studentIds: string[]
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await API.post(`/hod/students/sections/${sectionId}/allocate`, { studentIds });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.post(`/hod/sections/${sectionId}/allocate`, { studentIds });
        return fallback.data;
      }
      throw err;
    }
  },

  unallocateStudents: async (
    sectionId: string,
    studentIds: string[]
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await API.post(`/hod/students/sections/${sectionId}/unallocate`, { studentIds });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.post(`/hod/sections/${sectionId}/unallocate`, { studentIds });
        return fallback.data;
      }
      throw err;
    }
  },

  unallocateAllStudentsFromSection: async (
    sectionId: string
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      sectionId: string;
      sectionName: string;
      affectedCount: number;
    };
  }> => {
    try {
      const res = await API.post(`/hod/students/sections/${sectionId}/unallocate-all`);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.post(`/hod/sections/${sectionId}/unallocate-all`);
        return fallback.data;
      }
      throw err;
    }
  },

  moveStudentSection: async (
    sectionId: string,
    studentId: string,
    targetSectionId: string,
    newRollNumber?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await API.patch(`/hod/students/sections/${sectionId}/students/${studentId}/move`, {
        targetSectionId,
        newRollNumber,
      });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.patch(`/hod/sections/${sectionId}/students/${studentId}/move`, {
          targetSectionId,
          newRollNumber,
        });
        return fallback.data;
      }
      throw err;
    }
  },

  removeStudentFromSection: async (sectionId: string, studentId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await API.delete(`/hod/students/sections/${sectionId}/students/${studentId}/remove`);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.delete(`/hod/sections/${sectionId}/students/${studentId}/remove`);
        return fallback.data;
      }
      throw err;
    }
  },

  bulkDistributeStudents: async (
    distributions: Array<{ sectionId: string; studentIds: string[]; rollNumbers?: Record<string, string> }>
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await API.post('/hod/students/sections/distribute', { distributions });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.post('/hod/sections/distribute', { distributions });
        return fallback.data;
      }
      throw err;
    }
  },

  // 3. Faculty
  getFacultyList: async (params?: { branch?: string }): Promise<HodFacultyItem[]> => {
    const res = await API.get('/hod/faculty', { params });
    const list = res.data.data || [];
    if (res.data.hodDepartment) {
      (list as any).hodDepartment = res.data.hodDepartment;
    }
    return list;
  },

  createFaculty: async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    designation: string;
    joiningDate?: string;
    coreDepartmentId?: string;
    cycle?: string | null;
  }): Promise<any> => {
    const res = await API.post('/hod/faculty', data);
    return res.data;
  },

  getDepartments: async (): Promise<Array<{ id: string; code: string; name: string; type?: string }>> => {
    try {
      const res = await API.get('/hod/departments');
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const fallback = await API.get('/dean/departments');
        return fallback.data.data;
      }
      throw err;
    }
  },

  getFacultyDetail: async (id: string): Promise<any> => {
    const res = await API.get(`/hod/faculty/${id}`);
    return res.data.data;
  },

  removeFacultyFromTeachingDepartment: async (facultyId: string): Promise<{ success: boolean; message: string; removedCount?: number }> => {
    const res = await API.post(`/hod/faculty/${facultyId}/remove-from-department`);
    return res.data;
  },

  deactivateFaculty: async (facultyId: string): Promise<{ success: boolean; message: string }> => {
    const res = await API.post(`/hod/faculty/${facultyId}/deactivate`);
    return res.data;
  },

  assignFacultySubject: async (facultyId: string, data: {
    subjectId: string;
    semester: number;
    cycle?: string | null;
    section?: string;
    academicYear?: string;
    coreDepartmentId?: string;
    coreDepartmentCode?: string;
    teachingDepartmentId?: string;
    teachingDepartmentCode?: string;
    attendanceAccess?: boolean;
    marksAccess?: boolean;
  }): Promise<any> => {
    const res = await API.post(`/hod/faculty/${facultyId}/assignment`, data);
    return res.data;
  },

  unallocateFacultyAssignment: async (assignmentId: string, reason?: string): Promise<any> => {
    const res = await API.delete(`/hod/faculty/assignment/${assignmentId}`, {
      data: reason ? { reason } : undefined,
    });
    return res.data;
  },

  deleteFacultyAssignment: async (assignmentId: string, facultyId?: string): Promise<any> => {
    if (facultyId) {
      try {
        const res = await API.delete(`/hod/faculty/${facultyId}/assignment/${assignmentId}`);
        return res.data;
      } catch (err: any) {
        if (err.response?.status !== 404) throw err;
      }
    }
    const res = await API.delete(`/hod/faculty/assignment/${assignmentId}`);
    return res.data;
  },

  updateFacultyAssignment: async (id: string, data: any): Promise<any> => {
    const res = await API.put(`/hod/faculty/${id}/assignment`, data);
    return res.data;
  },

  toggleFacultyAccess: async (id: string, data: { attendanceAccess?: boolean; marksAccess?: boolean }): Promise<any> => {
    const res = await API.patch(`/hod/faculty/${id}/access`, data);
    return res.data;
  },

  resetFacultyPassword: async (id: string): Promise<{ temporaryPassword: string }> => {
    const res = await API.post(`/hod/faculty/${id}/reset-password`);
    return res.data.data;
  },

  toggleFacultyStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<any> => {
    const res = await API.patch(`/hod/faculty/${id}/status`, { status });
    return res.data;
  },

  getFacultyAssignments: async (
    paramsOrFacultyId?: { facultyId?: string; academicYear?: string; semester?: number; branch?: string; departmentId?: string; status?: string } | string,
    academicYearParam?: string
  ): Promise<any[]> => {
    let params: any = {};
    if (typeof paramsOrFacultyId === 'string') {
      params = { facultyId: paramsOrFacultyId, academicYear: academicYearParam };
    } else if (paramsOrFacultyId) {
      params = paramsOrFacultyId;
    }
    const res = await API.get('/hod/faculty/assignments', { params });
    return res.data.data;
  },

  transferFacultyAssignment: async (
    allocationId: string,
    data: {
      newFacultyCoreDepartmentId?: string;
      newFacultyCoreDepartmentCode?: string;
      newFacultyId: string;
      transferDate?: string;
      reason?: string;
    }
  ): Promise<{ success: boolean; message: string; data: any }> => {
    const res = await API.post(`/teaching-allocations/${allocationId}/transfer`, data);
    return res.data;
  },

  getFacultyAssignmentHistory: async (allocationId: string): Promise<any[]> => {
    const res = await API.get(`/teaching-allocations/${allocationId}/history`);
    return res.data.data;
  },

  // 4. Subjects & Academic Scheme
  getDepartmentScheme: async (): Promise<HodDepartmentSchemeData> => {
    const res = await API.get('/hod/scheme');
    return res.data.data;
  },

  updateDepartmentScheme: async (schemeId: string): Promise<{ success: boolean; message: string; data: { activeSchemeId: string; activeSchemeName: string } }> => {
    const res = await API.put('/hod/scheme', { schemeId });
    return res.data;
  },

  getSubjects: async (params?: { semester?: string | number; cycle?: string; schemeId?: string; academicYear?: string; status?: string; branch?: string }): Promise<HodSubjectItem[]> => {
    const res = await API.get('/hod/subjects', { params });
    return res.data.data;
  },

  createSubject: async (data: { code: string; name: string; semester: number; cycle?: string | null; credits?: number; type?: string; category?: string }): Promise<any> => {
    const res = await API.post('/hod/subjects', data);
    return res.data;
  },

  updateSubject: async (id: string, data: any): Promise<any> => {
    const res = await API.put(`/hod/subjects/${id}`, data);
    return res.data;
  },

  checkSubjectDeletion: async (id: string): Promise<{
    hasAttendanceHistory: boolean;
    sessionsCount: number;
    recordsCount: number;
    assignmentsCount: number;
    backupFilesCount: number;
    subject: {
      id: string;
      code: string;
      name: string;
      semester: number;
      status: string;
      credits?: number;
      type?: string;
    };
  }> => {
    const res = await API.get(`/hod/subjects/${id}/deletion-check`);
    return res.data.data;
  },

  deleteSubject: async (id: string, options?: { deactivate?: boolean }): Promise<any> => {
    const res = await API.delete(`/hod/subjects/${id}`, { params: options });
    return res.data;
  },

  assignSubject: async (data: any): Promise<any> => {
    const res = await API.post('/hod/subjects/assign', data);
    return res.data;
  },

  // 5. Attendance
  getAttendanceOverview: async (params?: { semester?: string | number; section?: string }): Promise<any> => {
    const res = await API.get('/hod/attendance/overview', { params });
    return res.data.data;
  },

  getAttendanceDefaulters: async (params?: { semester?: string | number; section?: string; academicYear?: string }): Promise<HodDefaulterItem[]> => {
    const res = await API.get('/hod/attendance/defaulters', { params });
    const data = res.data.data;
    if (Array.isArray(data)) {
      (data as any).threshold = res.data.threshold ?? 85.0;
    }
    return data;
  },

  getAttendanceSessions: async (): Promise<any[]> => {
    const res = await API.get('/hod/attendance/sessions');
    return res.data.data;
  },

  getConsolidatedAttendanceReport: async (params: { academicYear?: string; semester: number }): Promise<any> => {
    const res = await API.get('/hod/attendance/consolidated-report', { params });
    return res.data.data;
  },

  syncConsolidatedAttendance: async (data: { academicYear?: string; semester: number }): Promise<any> => {
    const res = await API.post('/hod/attendance/consolidated-sync', data);
    return res.data;
  },

  downloadConsolidatedAttendanceUrl: (params: { academicYear?: string; semester: number }): string => {
    const query = new URLSearchParams({
      academicYear: params.academicYear || '2026-27',
      semester: String(params.semester || 1),
    });
    return `/api/hod/attendance/consolidated-download?${query.toString()}`;
  },

  // 6. Academics
  getAcademicsOverview: async (): Promise<any> => {
    const res = await API.get('/hod/academics/overview');
    return res.data.data;
  },

  getBitwiseAnalysis: async (): Promise<any[]> => {
    const res = await API.get('/hod/academics/bitwise');
    return res.data.data;
  },

  getStudentPerformance: async (params?: { semester?: string | number; section?: string }): Promise<HodPerformanceItem[]> => {
    const res = await API.get('/hod/academics/performance', { params });
    return res.data.data;
  },

  // Dedicated Semester Cohort API
  getSemesterCohort: async (
    semester: number | string,
    params?: { academicYear?: string; search?: string; branch?: string }
  ): Promise<HodSemesterCohortPayload> => {
    const res = await API.get(`/hod/students/semesters/${semester}`, { params });
    return res.data.data;
  },

  // 7. Reports & Settings & Profile
  getReports: async (): Promise<any> => {
    const res = await API.get('/hod/reports');
    return res.data.data;
  },

  getSettings: async (params?: { academicYear?: string; semester?: string | number; section?: string }): Promise<any> => {
    const res = await API.get('/hod/settings', { params });
    return res.data.data;
  },

  updateDepartmentSettings: async (data: { attendanceThreshold: number; academicYear?: string }): Promise<any> => {
    const res = await API.patch('/hod/settings', data);
    return res.data;
  },

  getProfile: async (): Promise<any> => {
    const res = await API.get('/hod/profile');
    return res.data.data;
  },

  updateProfile: async (data: { firstName?: string; lastName?: string; phone?: string }): Promise<any> => {
    const res = await API.put('/hod/profile', data);
    return res.data;
  },

  updatePassword: async (data: { currentPassword: string; newPassword: string }): Promise<any> => {
    const res = await API.put('/hod/settings/password', data);
    return res.data;
  },

  // 9. Teaching Responsibilities
  getTeachingResponsibilities: async (): Promise<HodTeachingResponsibilitiesData> => {
    const res = await API.get('/hod/subject-handling/teaching-responsibilities');
    return res.data.data;
  },

  getAvailableSubjectsForHandling: async (semester: number | string): Promise<HodAvailableSubject[]> => {
    const res = await API.get('/hod/subject-handling/available-subjects', { params: { semester } });
    return res.data.data;
  },

  submitSubjectHandlingRequest: async (data: {
    semester: number;
    subjectId: string;
    academicYear?: string;
    reason?: string;
  }): Promise<{ success: boolean; message: string; data: HodSubjectHandlingRequestItem }> => {
    const res = await API.post('/hod/subject-handling/requests', data);
    return res.data;
  },

  getMySubjectHandlingRequests: async (): Promise<HodSubjectHandlingRequestItem[]> => {
    const res = await API.get('/hod/subject-handling/requests');
    return res.data.data;
  },

  // 10. Student Attendance & Marks Release Module
  getReleaseSemesters: async (params?: { academicYear?: string }): Promise<HodReleaseSemesterCard[]> => {
    const res = await API.get('/hod/release/semesters', { params });
    return res.data.semesters;
  },

  getReleaseSemesterSubjects: async (
    semester: number,
    params?: { academicYear?: string }
  ): Promise<HodReleaseSubjectItem[]> => {
    const res = await API.get(`/hod/release/semesters/${semester}/subjects`, { params });
    return res.data.subjects;
  },

  previewAttendanceRelease: async (params: {
    semester: number;
    subjectId: string;
    academicYear?: string;
  }): Promise<AttendanceReleasePreviewData> => {
    const res = await API.get('/hod/release/attendance/preview', { params });
    return res.data.data;
  },

  confirmAttendanceRelease: async (payload: {
    semester: number;
    subjectId: string;
    academicYear?: string;
  }): Promise<any> => {
    const res = await API.post('/hod/release/attendance/confirm', payload);
    return res.data;
  },

  previewMarksRelease: async (params: {
    semester: number;
    subjectId: string;
    assessmentType: string;
    academicYear?: string;
  }): Promise<MarksReleasePreviewData> => {
    const res = await API.get('/hod/release/marks/preview', { params });
    return res.data.data;
  },

  confirmMarksRelease: async (payload: {
    semester: number;
    subjectId: string;
    assessmentType: string;
    academicYear?: string;
  }): Promise<any> => {
    const res = await API.post('/hod/release/marks/confirm', payload);
    return res.data;
  },

  revokeAttendanceRelease: async (payload: {
    semester: number;
    subjectId: string;
    academicYear?: string;
  }): Promise<any> => {
    const res = await API.post('/hod/release/attendance/revoke', payload);
    return res.data;
  },

  revokeMarksRelease: async (payload: {
    semester: number;
    subjectId: string;
    assessmentType?: string;
    academicYear?: string;
  }): Promise<any> => {
    const res = await API.post('/hod/release/marks/revoke', payload);
    return res.data;
  },

  confirmSemesterAttendanceRelease: async (payload: {
    semester: number;
    academicYear?: string;
  }): Promise<any> => {
    const res = await API.post('/hod/release/semester/attendance/confirm', payload);
    return res.data;
  },

  revokeSemesterAttendanceRelease: async (payload: {
    semester: number;
    academicYear?: string;
  }): Promise<any> => {
    const res = await API.post('/hod/release/semester/attendance/revoke', payload);
    return res.data;
  },

  confirmSemesterMarksRelease: async (payload: {
    semester: number;
    academicYear?: string;
    assessmentType?: string;
  }): Promise<any> => {
    const res = await API.post('/hod/release/semester/marks/confirm', payload);
    return res.data;
  },

  revokeSemesterMarksRelease: async (payload: {
    semester: number;
    academicYear?: string;
    assessmentType?: string;
  }): Promise<any> => {
    const res = await API.post('/hod/release/semester/marks/revoke', payload);
    return res.data;
  },
};

export interface HodReleaseSemesterCard {
  semester: number;
  name: string;
  departmentScope: string;
  departmentCode: string;
  departmentName: string;
  totalSubjects: number;
  attendanceRelease: {
    total: number;
    released: number;
    percentage: number;
    status: 'NOT_RELEASED' | 'PARTIALLY_RELEASED' | 'RELEASED';
  };
  marksRelease: {
    totalAssessments: number;
    releasedAssessments: number;
    percentage: number;
    status: 'NOT_RELEASED' | 'PARTIALLY_RELEASED' | 'RELEASED';
  };
}

export interface HodReleaseSubjectItem {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  type: string;
  cycle: string | null;
  attendance: {
    status: string;
    isReleased: boolean;
    releasedAt: string | null;
    releasedBy: string | null;
    totalStudents: number;
    hasDriveFile: boolean;
    fileName: string | null;
    isSourceUpdated?: boolean;
  };
  marks: {
    status: string;
    releasedCount: number;
    totalAssessments: number;
    assessments: Record<string, {
      type: string;
      label: string;
      status: string;
      releasedAt: string | null;
      releasedBy: string | null;
      totalStudents: number;
      isSourceUpdated?: boolean;
    }>;
    hasDriveFile: boolean;
    fileName: string | null;
    isSourceUpdated?: boolean;
  };
}

export interface AttendanceReleasePreviewData {
  sourceInfo: {
    fileName: string;
    googleDriveFileId: string | null;
    googleDriveFileUrl: string | null;
    sourceType: string;
    lastSyncedAt: string | null;
    fingerprint: string;
  };
  subject: {
    id: string;
    code: string;
    name: string;
    credits: number;
    semester: number;
    academicYear: string;
  };
  stats: {
    totalStudents: number;
    eligibleCount: number;
    shortageCount: number;
    missingCount: number;
    averagePercentage: number | null;
  };
  students: Array<{
    sl: number;
    studentId: string;
    usn: string;
    name: string;
    section: string;
    conducted: number;
    attended: number;
    percentage: number | null;
    eligibility: string;
  }>;
  validation: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
  isAlreadyReleased: boolean;
  isSourceUpdated: boolean;
  currentRelease: {
    id: string;
    releasedAt: string;
    releasedBy: string | null;
  } | null;
}

export interface MarksReleasePreviewData {
  sourceInfo: {
    fileName: string;
    sheetName: string;
    googleDriveFileId: string | null;
    sourceType: string;
    lastSyncedAt: string | null;
    fingerprint: string;
  };
  subject: {
    id: string;
    code: string;
    name: string;
    semester: number;
    academicYear: string;
  };
  assessmentType: string;
  assessmentLabel: string;
  maxMarks: number;
  stats: {
    totalStudents: number;
    evaluatedCount: number;
    missingCount: number;
    averageMarks: number;
    highestMarks: number;
    lowestMarks: number;
  };
  students: Array<{
    sl: number;
    studentId: string;
    usn: string;
    name: string;
    marksObtained: number | null;
    maxMarks: number;
    percentage: number | null;
    status: string;
  }>;
  validation: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
  isAlreadyReleased: boolean;
  isSourceUpdated: boolean;
  currentRelease: {
    id: string;
    releasedAt: string;
    releasedBy: string | null;
  } | null;
}

export default hodService;
