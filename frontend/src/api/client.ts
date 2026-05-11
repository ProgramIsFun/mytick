import { STORAGE_TOKEN_KEY } from '../constants/storage';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function buildQuery(base: string, params: Record<string, string | undefined>) {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) parts.push(`${key}=${encodeURIComponent(val)}`);
  }
  return parts.length ? `${base}?${parts.join('&')}` : base;
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; name: string; username: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  updateMe: (data: { username?: string; name?: string; newPassword?: string }) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  generateServiceToken: (service: string, expiresIn?: string) =>
    request('/auth/service-token', { method: 'POST', body: JSON.stringify({ service, expiresIn }) }),

  // Tasks
  getTasks: (page = 1, limit = 20, type?: string, tag?: string, q?: string) =>
    request(buildQuery(`/tasks`, { page: String(page), limit: String(limit), type, tag, q })),
  getTask: (id: string) => request(`/tasks/${id}`),
  getBlocking: (id: string) => request(`/tasks/${id}/blocking`),
  getSubtasks: (id: string) => request(`/tasks/${id}/subtasks`),
  getProfile: (username: string) => request(`/tasks/u/${username}/profile`),
  getCalendar: (from: string, to: string) => request(`/tasks/calendar?from=${from}&to=${to}`),
  createTask: (data: Record<string, unknown>) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Record<string, unknown>) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  markOccurrence: (id: string, date: string, status: 'done' | 'skipped') =>
    request(`/tasks/${id}/occurrences`, { method: 'POST', body: JSON.stringify({ date, status }) }),
  editOccurrence: (id: string, date: string, overrides: Record<string, unknown>) =>
    request(`/tasks/${id}/occurrences`, { method: 'POST', body: JSON.stringify({ date, status: 'pending', ...overrides }) }),
  revertOccurrence: (id: string, date: string) =>
    request(`/tasks/${id}/occurrences`, { method: 'DELETE', body: JSON.stringify({ date }) }),
  endSeries: (id: string, date: string) =>
    request(`/tasks/${id}/end-series`, { method: 'POST', body: JSON.stringify({ date }) }),
  rollbackDescription: (id: string, index: number) =>
    request(`/tasks/${id}/rollback/${index}`, { method: 'POST' }),
  deleteTask: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
  getSharedTask: (token: string) => request(`/tasks/share/${token}`),
  getPublicTasks: (userId: string) => request(`/tasks/user/${userId}`),
  getPublicTasksByUsername: (username: string) => request(`/tasks/u/${username}`),

  // Groups
  getGroups: () => request('/groups'),
  createGroup: (name: string) =>
    request('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  addMember: (groupId: string, identifier: string, role: string = 'viewer') => {
    const body = identifier.includes('@') ? { email: identifier, role } : { userId: identifier, role };
    return request(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify(body) });
  },
  removeMember: (groupId: string, userId: string) =>
    request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  deleteGroup: (groupId: string) => request(`/groups/${groupId}`, { method: 'DELETE' }),

  // FCM
  registerFcmToken: (fcmToken: string) =>
    request('/auth/fcm-token', { method: 'POST', body: JSON.stringify({ fcmToken }) }),
  removeFcmToken: (fcmToken: string) =>
    request('/auth/fcm-token', { method: 'DELETE', body: JSON.stringify({ fcmToken }) }),
  testPush: (tokenIndex?: number) =>
    request('/auth/test-push', { method: 'POST', body: JSON.stringify(tokenIndex !== undefined ? { tokenIndex } : {}) }),
  getFcmTokens: () => request('/auth/fcm-tokens'),

  // Accounts
  getAccounts: (q?: string, tag?: string) =>
    request(buildQuery('/accounts', { q, tag })),
  getAccount: (id: string) => request(`/accounts/${id}`),
  createAccount: (data: Record<string, unknown>) =>
    request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: Record<string, unknown>) =>
    request(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id: string) => request(`/accounts/${id}`, { method: 'DELETE' }),

  // Domains
  getDomains: (q?: string, tag?: string, projectId?: string) =>
    request(buildQuery('/domains', { q, tag, projectId })),
  getDomain: (id: string) => request(`/domains/${id}`),
  createDomain: (data: Record<string, unknown>) =>
    request('/domains', { method: 'POST', body: JSON.stringify(data) }),
  updateDomain: (id: string, data: Record<string, unknown>) =>
    request(`/domains/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDomain: (id: string) => request(`/domains/${id}`, { method: 'DELETE' }),

  // Databases
  getDatabases: (q?: string, type?: string, backupEnabled?: boolean) =>
    request(buildQuery('/databases', {
      ...(q ? { search: q } : {}),
      ...(type ? { type } : {}),
      ...(backupEnabled !== undefined ? { backupEnabled: String(backupEnabled) } : {}),
    })),
  getDatabase: (id: string) => request(`/databases/${id}`),
  getBackupableDatabases: () => request('/databases/backupable'),
  createDatabase: (data: Record<string, unknown>) =>
    request('/databases', { method: 'POST', body: JSON.stringify(data) }),
  updateDatabase: (id: string, data: Record<string, unknown>) =>
    request(`/databases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDatabase: (id: string) => request(`/databases/${id}`, { method: 'DELETE' }),
  markBackupSuccess: (id: string) =>
    request(`/databases/${id}/backup-success`, { method: 'POST' }),
  getBackupHistory: (id: string, limit = 50) =>
    request(`/databases/${id}/backup-history?limit=${limit}`),
  getAllBackupHistory: (limit = 50) =>
    request(`/databases/backup-history?limit=${limit}`),

  // Secrets
  getSecrets: () => request('/secrets'),
  getSecret: (id: string) => request(`/secrets/${id}`),
  createSecret: (data: Record<string, unknown>) =>
    request('/secrets', { method: 'POST', body: JSON.stringify(data) }),
  updateSecret: (id: string, data: Record<string, unknown>) =>
    request(`/secrets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSecret: (id: string) => request(`/secrets/${id}`, { method: 'DELETE' }),

  // Subscriptions
  getSubscriptions: (params?: { status?: string; category?: string; tag?: string; q?: string }) =>
    request(buildQuery('/subscriptions', params || {})),
  getSubscription: (id: string) => request(`/subscriptions/${id}`),
  getSubscriptionStats: () => request('/subscriptions/stats'),
  createSubscription: (data: Record<string, unknown>) =>
    request('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  updateSubscription: (id: string, data: Record<string, unknown>) =>
    request(`/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSubscription: (id: string) => request(`/subscriptions/${id}`, { method: 'DELETE' }),

  // Context
  getContextEntries: () => request('/context'),
  getContext: (key: string) => request(`/context/${key}`),
  setContext: (key: string, value: string) =>
    request(`/context/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  deleteContext: (key: string) => request(`/context/${key}`, { method: 'DELETE' }),
};
