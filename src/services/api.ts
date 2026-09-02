import {
  Alert,
  AlertStatus,
  AuthResponse,
  DashboardSummary,
  ModelInsightsData,
  Prediction,
  Project,
  ProjectMonitoringData,
  User,
  UserRole,
  UserProfile,
  CreateProjectPayload,
  ValidationResult,
  ChatResponse,
} from '../types';

const BASE_URL = '/api';
const TOKEN_STORAGE_KEY = 'project_sentinel_token';
const USER_STORAGE_KEY = 'project_sentinel_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAuthSession(token: string, user: User) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------

export async function loginUser(credentials: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }

  saveAuthSession(data.access_token, data.user);
  return data;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'officer';
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  saveAuthSession(data.access_token, data.user);
  return data;
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    clearAuthSession();
    throw new Error('Session expired or invalid. Please log in again.');
  }

  const data = await res.json();
  if (data.user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
  }
  return data.user;
}

// ----------------------------------------------------
// Core Predictive & Risk Data API
// ----------------------------------------------------

export async function fetchDashboard(): Promise<DashboardSummary> {
  const res = await fetch(`${BASE_URL}/dashboard`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard data');
  return res.json();
}

export async function fetchProjects(params?: {
  sector?: string;
  risk_level?: string;
  data_source?: string;
  search?: string;
  sort_by?: string;
}): Promise<Project[]> {
  const query = new URLSearchParams();
  if (params?.sector && params.sector !== 'ALL') query.append('sector', params.sector);
  if (params?.risk_level && params.risk_level !== 'ALL') query.append('risk_level', params.risk_level);
  if (params?.data_source && params.data_source !== 'ALL') query.append('data_source', params.data_source);
  if (params?.search) query.append('search', params.search);
  if (params?.sort_by) query.append('sort_by', params.sort_by);

  const url = `${BASE_URL}/projects${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function fetchProjectById(id: string): Promise<{ project: Project; history: ProjectMonitoringData[] }> {
  const res = await fetch(`${BASE_URL}/projects/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch project ${id}`);
  return res.json();
}

export async function fetchAlerts(params?: {
  severity?: string;
  status?: string;
  alert_type?: string;
}): Promise<Alert[]> {
  const query = new URLSearchParams();
  if (params?.severity && params.severity !== 'ALL') query.append('severity', params.severity);
  if (params?.status && params.status !== 'ALL') query.append('status', params.status);
  if (params?.alert_type && params.alert_type !== 'ALL') query.append('alert_type', params.alert_type);

  const url = `${BASE_URL}/alerts${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function updateAlertStatus(alertId: string, status: AlertStatus): Promise<Alert> {
  const res = await fetch(`${BASE_URL}/alerts/${alertId}`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || 'Failed to update alert status');
  }
  return res.json();
}

export async function uploadProjectData(
  fileOrPayload: { file?: File; csv_text?: string; records?: any[] },
  commit: boolean = false,
  dataSource: string = 'Imported Data'
): Promise<{ success: boolean; preview_mode?: boolean; message?: string; validation: ValidationResult; import_stats?: any }> {
  if (fileOrPayload.file) {
    const formData = new FormData();
    formData.append('file', fileOrPayload.file);
    formData.append('data_source', dataSource);
    if (commit) formData.append('commit', 'true');

    const res = await fetch(`${BASE_URL}/upload-data${commit ? '?commit=true' : ''}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to upload file');
    }
    return res.json();
  } else {
    const res = await fetch(`${BASE_URL}/upload-data${commit ? '?commit=true' : ''}`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        ...fileOrPayload,
        commit,
        data_source: dataSource,
      }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to process data');
    }
    return res.json();
  }
}

export async function fetchModelInsights(): Promise<ModelInsightsData> {
  const res = await fetch(`${BASE_URL}/model-insights`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch model insights');
  return res.json();
}

export async function runProjectPrediction(projectId: string): Promise<{ project: Project; prediction: Prediction; alerts: Alert[] }> {
  const res = await fetch(`${BASE_URL}/predict/${projectId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Failed to recalculate prediction for project ${projectId}`);
  }
  return res.json();
}

export async function simulatePrediction(scenario: {
  original_cost: number;
  revised_cost: number;
  expenditure: number;
  physical_progress: number;
  timeline_revision_months: number;
  sector: string;
}): Promise<{ features: any; prediction: Prediction; alerts: Alert[] }> {
  const res = await fetch(`${BASE_URL}/predict/simulate`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(scenario),
  });
  if (!res.ok) throw new Error('Simulation failed');
  return res.json();
}

export async function sendChatMessage(
  message: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = [],
  currentProjectId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message,
      history,
      currentProjectId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to communicate with AI Assistant');
  }
  return data;
}

// ----------------------------------------------------
// Project Management API (Admin only)
// ----------------------------------------------------

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const res = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create project');
  }
  return data;
}

// ----------------------------------------------------
// User Management API (Admin only)
// ----------------------------------------------------

export async function fetchUsers(): Promise<UserProfile[]> {
  const res = await fetch(`${BASE_URL}/admin/users`, {
    headers: getAuthHeaders(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch user list');
  }
  return data;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update user role');
  }
  return data;
}

