/**
 * NubianFit API Client Service
 * Typed wrapper around the FastAPI backend, authenticated with a bearer JWT.
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
  Habit,
  HabitCheckin,
  FoodResult,
  FoodLogEntry,
  ClientGoals,
  DailyMetric,
  MealPlan,
  MealPlanAssignment,
  Nutrients,
  Serving,
  WorkoutTemplate
} from '../types';

export const API_BASE_URL = ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) || '/api';

const TOKEN_KEY = 'nubianfit_token';

/** Fired when the server rejects our token; AuthContext listens and signs the user out. */
export const SESSION_EXPIRED_EVENT = 'nubianfit:session_expired';

export const tokenStore = {
  get: (): string | null => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (token: string) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const token = tokenStore.get();
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
      if (response.status === 401 && tokenStore.get()) {
        tokenStore.clear();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      let errorMsg = `Request failed (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : 'Please check the details and try again.';
        }
      } catch {
        // use default error message
      }
      throw new ApiError(errorMsg, response.status);
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
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'coach' | 'client';
  clientId: string | null;
  avatar: string;
  isActive: boolean;
  hasPassword: boolean;
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
}

const storeSession = (data: TokenResponse) => {
  tokenStore.set(data.accessToken);
  return data.user;
};

export const authApi = {
  login: async (email: string, password: string) =>
    storeSession(await api.post<TokenResponse>('/auth/login', { email, password })),
  registerCoach: async (payload: { email: string; password: string; fullName: string; inviteCode: string }) =>
    storeSession(await api.post<TokenResponse>('/auth/register-coach', payload)),
  requestCode: (email: string) => api.post<{ message: string }>('/auth/otp/request', { email }),
  verifyCode: async (email: string, code: string) =>
    storeSession(await api.post<TokenResponse>('/auth/otp/verify', { email, code })),
  me: () => api.get<AuthUser>('/auth/me'),
  changePassword: (newPassword: string, currentPassword?: string) =>
    api.post<AuthUser>('/auth/change-password', { newPassword, currentPassword }),
  /** Dev builds only: the backend rejects this in production. */
  devLogin: async (role: 'coach' | 'client') =>
    storeSession(await api.post<TokenResponse>(`/auth/dev-login?role=${role}`)),
  logout: () => tokenStore.clear(),
};

// Clients Endpoints
export const clientsApi = {
  getAll: (params?: { status?: string; search?: string }) => api.get<Client[]>('/clients', params),
  getById: (id: string) => api.get<Client>(`/clients/${id}`),
  create: (client: Partial<Client>, sendInvite = false) =>
    api.post<Client>(`/clients${sendInvite ? '?sendInvite=true' : ''}`, client),
  invite: (id: string) => api.post<{ message: string }>(`/clients/${id}/invite`),
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
  assign: (programId: string, clientId: string, startDate?: string) =>
    api.post<{ message: string; scheduled_count: number }>(`/programs/${programId}/assign`, { clientId, startDate }),
  unassign: (programId: string, clientId: string) =>
    api.delete<{ message: string; removed: number }>(`/programs/${programId}/assign/${clientId}`),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/programs/${id}`),
};

// Workout Library Endpoints (coach only)
export const workoutTemplatesApi = {
  getAll: () => api.get<WorkoutTemplate[]>('/workout-templates'),
  create: (template: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<WorkoutTemplate>('/workout-templates', template),
  update: (id: string, updates: Partial<WorkoutTemplate>) => api.patch<WorkoutTemplate>(`/workout-templates/${id}`, updates),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/workout-templates/${id}`),
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
    payload: {
      clientFeedback?: string;
      coachFeedback?: string;
      rating?: number;
      durationMin?: number;
      exercises?: ScheduledWorkout['exercises'];
      groups?: ScheduledWorkout['groups'];
      totalVolumeKg?: number;
      prCount?: number;
    }
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

// Habits Endpoints
export const habitsApi = {
  getAll: (params?: { clientId?: string }) => api.get<Habit[]>('/habits', params),
  create: (habit: Omit<Habit, 'id' | 'active'>) => api.post<Habit>('/habits', habit),
  update: (id: string, updates: Partial<Habit>) => api.patch<Habit>(`/habits/${id}`, updates),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/habits/${id}`),
  checkins: (params?: { clientId?: string; from?: string; to?: string }) => api.get<HabitCheckin[]>('/habits/checkins', params),
  checkIn: (habitId: string, date: string, completed: boolean, value?: number | null) =>
    api.put<HabitCheckin>('/habits/checkins', { habitId, date, completed, value }),
};

// Foods (USDA + custom) Endpoints
export const foodsApi = {
  search: (q: string) => api.get<{ results: FoodResult[]; usdaError: string | null }>('/foods/search', { q }),
  usda: (fdcId: string) => api.get<FoodResult>(`/foods/usda/${fdcId}`),
  custom: () => api.get<FoodResult[]>('/foods/custom'),
  createCustom: (food: { name: string; brand?: string; per100g: Nutrients; servings: Serving[] }) =>
    api.post<FoodResult>('/foods/custom', food),
  updateCustom: (id: string, food: { name?: string; brand?: string; per100g?: Nutrients; servings?: Serving[] }) =>
    api.patch<FoodResult>(`/foods/custom/${id}`, food),
  deleteCustom: (id: string) => api.delete<{ message: string; id: string }>(`/foods/custom/${id}`),
};

// Nutrition Endpoints
export const nutritionApi = {
  goals: (params?: { clientId?: string }) => api.get<ClientGoals[]>('/nutrition/goals', params),
  setGoals: (clientId: string, goals: Omit<ClientGoals, 'clientId'>) => api.put<ClientGoals>(`/nutrition/goals/${clientId}`, goals),
  log: (params?: { clientId?: string; from?: string; to?: string }) => api.get<FoodLogEntry[]>('/nutrition/log', params),
  addFood: (entry: Omit<FoodLogEntry, 'id' | 'createdAt'>) => api.post<FoodLogEntry>('/nutrition/log', entry),
  updateFood: (id: string, updates: Partial<Pick<FoodLogEntry, 'meal' | 'quantity'>>) => api.patch<FoodLogEntry>(`/nutrition/log/${id}`, updates),
  deleteFood: (id: string) => api.delete<{ message: string; id: string }>(`/nutrition/log/${id}`),
  daily: (params?: { clientId?: string; from?: string; to?: string }) => api.get<DailyMetric[]>('/nutrition/daily', params),
  setDaily: (body: { clientId: string; date: string; waterMl?: number; steps?: number }) => api.put<DailyMetric>('/nutrition/daily', body),
};

// Meal Plan Endpoints
export const mealPlansApi = {
  getAll: () => api.get<MealPlan[]>('/meal-plans'),
  create: (plan: Pick<MealPlan, 'title' | 'description' | 'days'>) => api.post<MealPlan>('/meal-plans', plan),
  update: (id: string, plan: Pick<MealPlan, 'title' | 'description' | 'days'>) => api.put<MealPlan>(`/meal-plans/${id}`, plan),
  delete: (id: string) => api.delete<{ message: string; id: string }>(`/meal-plans/${id}`),
  assignments: () => api.get<MealPlanAssignment[]>('/meal-plans/assignments'),
  assign: (planId: string, clientId: string, startDate: string) =>
    api.post<MealPlanAssignment>(`/meal-plans/${planId}/assign`, { clientId, startDate }),
  unassign: (clientId: string) => api.delete<{ message: string }>(`/meal-plans/assignments/${clientId}`),
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
  send: (clientId: string, text: string, attachment?: ChatMessage['attachment']) =>
    api.post<ChatMessage>('/messages', { clientId, text, attachment }),
  markRead: (clientId: string) => api.post<{ message: string }>(`/messages/read?clientId=${encodeURIComponent(clientId)}`),
};

// Activity Feed Endpoints
export const activityApi = {
  getAll: (limit = 25) => api.get<ActivityFeedItem[]>(`/activity?limit=${limit}`),
};
