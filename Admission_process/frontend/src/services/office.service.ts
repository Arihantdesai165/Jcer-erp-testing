import API from './api';

export interface HOD {
  id: string;
  userId: string;
  departmentId: string;
  tenureStartDate: string;
  isActive: boolean;
  appointmentOrderNo: string;
  appointmentDate: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export interface Parent {
  id: string;
  userId: string;
  studentId: string;
  relation: string;
  occupation: string;
  annualIncome: number;
  isPrimaryContact: boolean;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  type: string;
  audience: string;
  status: string;
  createdAt: string;
  publishedAt?: string;
  createdBy?: { firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string };
}

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  sender?: { firstName: string; lastName: string; email: string };
  handledBy?: { firstName: string; lastName: string };
}

export interface PendingCredential {
  id: string;
  enrollmentNumber: string;
  admissionStatus: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export interface DashboardData {
  quickStats: {
    totalUsers: number;
    activeUsers: number;
    pendingTasks: number;
    alertsToday: number;
  };
  moduleCounts: {
    students: number;
    enrolledStudents?: number;
    teachers: number;
    hods: number;
    principals: number;
    parents: number;
    admissions: number;
  };
  recentActivities: {
    id: string;
    action: string;
    detail: string;
    createdAt: string;
  }[];
}

const officeService = {
  // User Stats
  getUserStats: async (): Promise<{ totalUsers: number; activeUsers: number }> => {
    const res = await API.get('/admin/user-stats');
    return {
      totalUsers: res.data.totalUsers ?? 0,
      activeUsers: res.data.activeUsers ?? 0,
    };
  },

  // HODs
  getHODs: async (): Promise<HOD[]> => {
    const res = await API.get('/admin/hods');
    return res.data.data;
  },

  // Parents
  getParents: async (): Promise<Parent[]> => {
    const res = await API.get('/admin/parents');
    return res.data.data;
  },

  // Notifications
  getNotifications: async (): Promise<Notification[]> => {
    const res = await API.get('/admin/notifications');
    return res.data.data;
  },
  
  createNotification: async (payload: Partial<Notification>): Promise<Notification> => {
    const res = await API.post('/admin/notifications', payload);
    return res.data.data;
  },
  
  publishNotification: async (id: string): Promise<Notification> => {
    const res = await API.put(`/admin/notifications/${id}/publish`);
    return res.data.data;
  },

  // Tickets
  getTickets: async (): Promise<Ticket[]> => {
    const res = await API.get('/admin/tickets');
    return res.data.data;
  },

  resolveTicket: async (id: string): Promise<Ticket> => {
    const res = await API.put(`/admin/tickets/${id}/resolve`);
    return res.data.data;
  },

  // Credentials
  getPendingCredentials: async (): Promise<PendingCredential[]> => {
    const res = await API.get('/admin/credentials/pending');
    return res.data.data;
  },

  bulkDispatchCredentials: async (studentIds: string[]): Promise<any> => {
    const res = await API.post('/admin/credentials/bulk-dispatch', { studentIds });
    return res.data;
  },

  // Fee Reports
  getFeeReportData: async (): Promise<{ deptChartData: any[]; records: any[] }> => {
    const res = await API.get('/admin/reports/fees');
    return res.data.data;
  },

  // Dashboard
  getDashboardData: async (params?: { academicYear?: string }): Promise<DashboardData> => {
    const res = await API.get('/admin/dashboard', { params });
    return res.data.data;
  },

  getAnalyticsData: async (params?: any): Promise<any> => {
    const res = await API.get('/admin/analytics', { params });
    return res.data.data;
  },

  getPrincipalAnalytics: async (params?: any): Promise<any> => {
    const res = await API.get('/principal/analytics', { params });
    return res.data.data;
  }
};

export default officeService;
