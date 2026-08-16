/**
 * NubianFit API Client Service
 * Connects frontend to the FastAPI backend with JWT authentication and fallback resiliency.
 */

import {
  Client,
  Exercise,
  TrainingProgram,
  ScheduledWorkout,
  MetricEntry,
  PersonalRecord,
  ProgressPhoto,
  ChatMessage,
  ActivityFeedItem,
  ClientDailyHabitLog
} from '../types';

export const API_BASE_URL = ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) || '/api';

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const token = localStorage.getItem('nubianfit_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let errorMsg = `API Error ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // use default error message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

// Auth Endpoints
export const authApi = {
  login: async (email: string, password: string) => {
    const data = await api.post<{ access_token: string; token_type: string; user: any }>('/auth/login', {
      email,
      password,
    });
    if (data?.access_token) {
      localStorage.setItem('nubianfit_token', data.access_token);
      localStorage.setItem('nubianfit_user', JSON.stringify(data.user));
    }
    return data;
  },
  me: () => api.get<any>('/auth/me'),
  logout: () => {
    localStorage.removeItem('nubianfit_token');
    localStorage.removeItem('nubianfit_user');
  },
};

// Clients Endpoints
export const clientsApi = {
  getAll: (params?: { status?: string; search?: string }) => api.get<Client[]>('/clients', params),
  getById: (id: string) => api.get<Client>(`/clients/${id}`),
  create: (client: Partial<Client>) => api.post<Client>('/clients', client),
  update: (id: string, updates: Partial<Client>) => api.patch<Client>(`/clients/${id}`, updates),
  addNote: (id: string, note: string) => api.post<Client>(`/clients/${id}/notes`, { note }),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/clients/${id}`),
};

// Exercises Endpoints
export const exercisesApi = {
  getAll: (params?: { muscle?: string; equipment?: string; difficulty?: string; search?: string }) =>
    api.get<Exercise[]>('/exercises', params),
  getById: (id: string) => api.get<Exercise>(`/exercises/${id}`),
  create: (exercise: Partial<Exercise>) => api.post<Exercise>('/exercises', exercise),
  update: (id: string, updates: Partial<Exercise>) => api.patch<Exercise>(`/exercises/${id}`, updates),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/exercises/${id}`),
};

// Training Programs Endpoints
export const programsApi = {
  getAll: (params?: { goal?: string; difficulty?: string }) => api.get<TrainingProgram[]>('/programs', params),
  getById: (id: string) => api.get<TrainingProgram>(`/programs/${id}`),
  save: (program: TrainingProgram) => api.post<TrainingProgram>('/programs', program),
  update: (id: string, updates: Partial<TrainingProgram>) => api.patch<TrainingProgram>(`/programs/${id}`, updates),
  assign: (programId: string, clientId: string) =>
    api.post<{ message: string; scheduled_count: number }>(`/programs/${programId}/assign`, { client_id: clientId }),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/programs/${id}`),
};

// Scheduled Workouts Endpoints
export const workoutsApi = {
  getAll: (params?: { clientId?: string; date?: string; status?: string }) =>
    api.get<ScheduledWorkout[]>('/workouts', params),
  getById: (id: string) => api.get<ScheduledWorkout>(`/workouts/${id}`),
  create: (workout: Partial<ScheduledWorkout>) => api.post<ScheduledWorkout>('/workouts', workout),
  update: (id: string, updates: Partial<ScheduledWorkout>) => api.patch<ScheduledWorkout>(`/workouts/${id}`, updates),
  complete: (
    id: string,
    payload: { clientFeedback?: string; coachFeedback?: string; rating?: number; durationMin?: number; exercises?: any[] }
  ) => api.post<ScheduledWorkout>(`/workouts/${id}/complete`, payload),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/workouts/${id}`),
};

// Biometric Metrics Endpoints
export const metricsApi = {
  getAll: (params?: { clientId?: string }) => api.get<MetricEntry[]>('/metrics', params),
  create: (metric: Partial<MetricEntry>) => api.post<MetricEntry>('/metrics', metric),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/metrics/${id}`),
};

// Personal Records (PRs) Endpoints
export const prsApi = {
  getAll: (params?: { clientId?: string }) => api.get<PersonalRecord[]>('/prs', params),
  create: (pr: Partial<PersonalRecord>) => api.post<PersonalRecord>('/prs', pr),
};

// Habit Logs Endpoints
export const habitsApi = {
  getAll: (params?: { clientId?: string; date?: string }) => api.get<ClientDailyHabitLog[]>('/habits', params),
  toggle: (clientId: string, date: string, habitId: string) =>
    api.post<ClientDailyHabitLog>('/habits/toggle', { clientId, date, habitId }),
};

// Progress Photos Endpoints
export const photosApi = {
  getAll: (params?: { clientId?: string }) => api.get<ProgressPhoto[]>('/photos', params),
  create: (photo: Partial<ProgressPhoto>) => api.post<ProgressPhoto>('/photos', photo),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/photos/${id}`),
};

// Chat Messages Endpoints
export const messagesApi = {
  getAll: (params?: { clientId?: string }) => api.get<ChatMessage[]>('/messages', params),
  send: (clientId: string, text: string, attachment?: any) =>
    api.post<ChatMessage>('/messages', { clientId, sender: 'coach', text, attachment }),
};

// Activity Feed Endpoints
export const activityApi = {
  getAll: (limit = 25) => api.get<ActivityFeedItem[]>(`/activity?limit=${limit}`),
};
