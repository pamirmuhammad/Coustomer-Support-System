import axios, { type AxiosResponse } from 'axios';
import { apiCache, CACHE_TTL } from '../utils/apiCache';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export { API_BASE_URL };

function clearUser() {
  localStorage.removeItem('user');
}

function isInUseError(error: any): boolean {
  const msg = error.response?.data?.message || error.response?.data || '';
  return typeof msg === 'string' && (
    msg.toLowerCase().includes('in use') ||
    msg.toLowerCase().includes('referenced') ||
    msg.toLowerCase().includes('foreign key') ||
    msg.toLowerCase().includes('constraint') ||
    msg.toLowerCase().includes('cannot delete')
  );
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (err: any) => void }> = [];

function processQueue(error: any) {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (originalRequest.url === '/auth/me' && status === 401) {
      return Promise.resolve({ data: null });
    }

    if (status === 409 || (status === 403 && isInUseError(error))) {
      return Promise.reject(error);
    }

    if (status !== 401) return Promise.reject(error);
    if (originalRequest._retry) return Promise.reject(error);

    if (originalRequest.url === '/auth/refresh') {
      clearUser();
      window.location.href = '/signin';
      return Promise.reject(error);
    }

    if (originalRequest.url?.startsWith('/auth/') && !isInUseError(error)) {
      return Promise.reject(error);
    }

    if (!isRefreshing) {
      isRefreshing = true;
      originalRequest._retry = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        clearUser();
        window.location.href = '/signin';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    } else {
      return new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => api(originalRequest));
    }
  }
);

export const adminAPI = {
  getDashboardSummary: () =>
    api.get('/admin/dashboard-summary'),
};

export const backupAPI = {
  download: () =>
    api.get('/admin/backup/download', { responseType: 'blob' }),
  restore: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/backup/restore', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
  },
};

export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  signup: (data: SignupData) => {
    apiCache.invalidate('users');
    return api.post('/auth/signup', data);
  },
  signupSendOtp: (email: string) =>
    api.post('/auth/signup/send-otp', { email }),
  verifySignupOTP: (email: string, otp: string) =>
    api.post('/auth/signup/verify-otp', { email, otp }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  verifyOTP: (email: string, otp: string) =>
    api.post('/auth/verify-otp', { email, otp }),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    api.post('/auth/reset-password', { email, otp, newPassword }),
  me: () =>
    api.get('/auth/me'),
  logout: () =>
    api.post('/auth/logout'),
  forcePasswordChange: (newPassword: string) =>
    api.put('/auth/force-password-change', { newPassword }),
};

export const serviceAPI = {
  getAll: (sortBy?: string, sortOrder?: string) =>
    apiCache.fetch<AxiosResponse>(
      'services',
      () => api.get('/services', { params: { sortBy, sortOrder } }),
      CACHE_TTL.SERVICES
    ),
  create: (data: ServiceData) => {
    apiCache.invalidate('services');
    return api.post('/services', data);
  },
  update: async (id: number, data: ServiceData) => {
    const response = await api.put(`/services/${id}`, data);
    apiCache.invalidate('services');
    return response;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/services/${id}`);
    apiCache.invalidate('services');
    return response;
  },
  clearCache: () => {
    apiCache.invalidate('services');
  },
};

export const userAPI = {
  getAll: () =>
    apiCache.fetch<AxiosResponse>(
      'users',
      () => api.get('/users'),
      CACHE_TTL.USERS
    ),
  create: async (data: UserData) => {
    const response = await api.post('/users', data);
    apiCache.invalidate('users');
    return response;
  },
  update: async (id: number, data: UserData) => {
    const response = await api.put(`/users/${id}`, data);
    apiCache.invalidate('users');
    return response;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    apiCache.invalidate('users');
    return response;
  },
  changePassword: (id: number, currentPassword: string, newPassword: string) => api.put(`/users/${id}/password`, { currentPassword, newPassword }),
  updateProfilePicture: (userId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/users/${userId}/profile-picture`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getByService: (serviceName: string) => api.get(`/users/by-service/${serviceName}`),
};

export const organizationAPI = {
  getAll: () =>
    apiCache.fetch<AxiosResponse>(
      'organizations',
      () => api.get('/organizations'),
      CACHE_TTL.ORGANIZATIONS
    ),
  create: async (data: OrganizationData) => {
    const response = await api.post('/organizations', data);
    apiCache.invalidate('organizations');
    return response;
  },
  update: async (id: number, data: OrganizationData) => {
    const response = await api.put(`/organizations/${id}`, data);
    apiCache.invalidate('organizations');
    return response;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/organizations/${id}`);
    apiCache.invalidate('organizations');
    return response;
  },
  getStats: (id: number) => api.get(`/organizations/${id}/stats`),
};

export const ticketAPI = {
  getAll: () => api.get('/tickets'),
  getById: (id: number) => api.get(`/tickets/${id}`),
  getByOrganization: (orgId: number) => api.get(`/tickets/organization/${orgId}`),
  getByAssignedUser: (userId: number) => api.get(`/tickets/assigned/${userId}`),
  getUnassigned: () => api.get('/tickets/unassigned'),
  getRecent: (limit: number = 5) => api.get(`/tickets/recent?limit=${limit}`),
  create: (data: FormData) => api.post('/tickets', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id: number, data: TicketData) => api.put(`/tickets/${id}`, data),
  updateWithAttachment: (id: number, data: FormData) => api.put(`/tickets/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  assign: (ticketId: number, userId: number) =>
    api.post(`/tickets/${ticketId}/assign/${userId}`),
  unassign: (ticketId: number) =>
    api.delete(`/tickets/${ticketId}/assign`),
  updateStatus: (id: number, status: string) =>
    api.patch(`/tickets/${id}/status`, { status }),
  addComment: (ticketId: number, userId: number, message: string) =>
    api.post(`/tickets/${ticketId}/comments`, { userId, message }),
  getComments: (ticketId: number) => api.get(`/tickets/${ticketId}/comments`),
  getCommentCount: (ticketId: number) => api.get(`/tickets/${ticketId}/comments/count`),
  delete: (id: number) => api.delete(`/tickets/${id}`),
  getStatistics: () => api.get('/tickets/statistics'),
  getDashboard: () => api.get('/tickets/dashboard'),
};

export const notificationAPI = {
  getAll: (userId: number, size: number = 20) => api.get(`/notifications/user/${userId}?size=${size}`),
  getUnread: (userId: number) => api.get(`/notifications/unread/${userId}`),
  getUnreadCount: (userId: number) => api.get(`/notifications/count/${userId}`),
  markAsRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: (userId: number) => api.patch(`/notifications/user/${userId}/read-all`),
  delete: (id: number) => api.delete(`/notifications/${id}`),
  deleteAll: (userId: number) => api.delete(`/notifications/user/${userId}`),
};

export const roleAPI = {
  getAll: () =>
    apiCache.fetch<AxiosResponse>(
      'roles',
      () => api.get('/roles'),
      CACHE_TTL.ROLES
    ),
  create: async (data: { name: string; description?: string }) => {
    const response = await api.post('/roles', data);
    apiCache.invalidate('roles');
    return response;
  },
  update: async (id: number, data: { name: string; description?: string }) => {
    const response = await api.put(`/roles/${id}`, data);
    apiCache.invalidate('roles');
    return response;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/roles/${id}`);
    apiCache.invalidate('roles');
    return response;
  },
};

interface SignupData {
  fullName?: string;
  username: string;
  password: string;
  email: string;
  phone?: string;
  roleId?: number;
  organizationId?: number;
  otp: string;
}

interface ServiceData {
  name: string;
  description?: string;
}

interface UserData {
  fullName?: string;
  username: string;
  password?: string;
  email?: string;
  phone?: string;
  roleId?: number;
  organizationId?: number;
  active?: boolean;
  photo?: string;
}

interface OrganizationData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface TicketData {
  subject: string;
  description?: string;
  serviceId: number;
  organizationId: number;
  status?: string;
}

export function extractArrayData<T>(data: unknown): T[] {
  if (!data) return [];
  return Array.isArray(data) ? (data as T[]) : ((data as { data?: T[] }).data || []);
}

export default api;
