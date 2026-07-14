import { STORAGE_TOKEN_KEY } from '../constants/storage';
import type { Account } from '../types/account';
import type { Database } from '../types/database';
import type { Secret } from '../types/secret';
import type { Domain } from '../types/domain';
import type { Subscription } from '../types/subscription';

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
  return await res.json();
}

function buildQuery(base: string, params: Record<string, string | undefined>) {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) parts.push(`${key}=${encodeURIComponent(val)}`);
  }
  return parts.length ? `${base}?${parts.join('&')}` : base;
}

function crud<T>(basePath: string, listFn?: (params?: Record<string, string>) => Promise<T>) {
  return {
    list: listFn ?? ((params?: Record<string, string | undefined>) => request(buildQuery(basePath, params || {})) as Promise<T>),
    get: (id: string) => request(`${basePath}/${id}`),
    create: (data: Record<string, unknown>) => request(basePath, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) => request(`${basePath}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`${basePath}/${id}`, { method: 'DELETE' }),
  };
}

export const accountsApi = crud<Account[]>('/accounts');
export const domainsApi = crud<Domain[]>('/domains');
export const databasesApi = crud<Database[]>('/databases');
export const secretsApi = crud<Secret[]>('/secrets');
export const subscriptionsApi = crud<Subscription[]>('/subscriptions');

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
  getTasks: (page = 1, limit = 20, type?: string, tag?: string, q?: string, excludeStatus?: string) =>
    request(buildQuery(`/tasks`, { page: String(page), limit: String(limit), type, tag, q, excludeStatus })),
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

  // Accounts (standard CRUD via accountsApi)
  getAccounts: (q?: string, tag?: string) =>
    request(buildQuery('/accounts', { q, tag })),
  getAccount: accountsApi.get,
  createAccount: accountsApi.create,
  updateAccount: accountsApi.update,
  deleteAccount: accountsApi.delete,

  // Domains (standard CRUD via domainsApi)
  getDomains: (q?: string, tag?: string, projectId?: string) =>
    request(buildQuery('/domains', { q, tag, projectId })),
  getDomain: domainsApi.get,
  createDomain: domainsApi.create,
  updateDomain: domainsApi.update,
  deleteDomain: domainsApi.delete,

  // Databases (standard CRUD via databasesApi + custom backup methods)
  getDatabases: (q?: string, type?: string, backupEnabled?: boolean) =>
    request(buildQuery('/databases', {
      ...(q ? { search: q } : {}),
      ...(type ? { type } : {}),
      ...(backupEnabled !== undefined ? { backupEnabled: String(backupEnabled) } : {}),
    })),
  getDatabase: databasesApi.get,
  getBackupableDatabases: () => request('/databases/backupable'),
  createDatabase: databasesApi.create,
  updateDatabase: databasesApi.update,
  deleteDatabase: databasesApi.delete,
  markBackupSuccess: (id: string) =>
    request(`/databases/${id}/backup-success`, { method: 'POST' }),
  getBackupHistory: (id: string, limit = 50) =>
    request(`/databases/${id}/backup-history?limit=${limit}`),
  getAllBackupHistory: (limit = 50) =>
    request(`/databases/backup-history?limit=${limit}`),

  // Secrets (standard CRUD via secretsApi)
  getSecrets: secretsApi.list,
  getSecret: secretsApi.get,
  createSecret: secretsApi.create,
  updateSecret: secretsApi.update,
  deleteSecret: secretsApi.delete,

  // Subscriptions (standard CRUD via subscriptionsApi + custom stats)
  getSubscriptions: (params?: { status?: string; category?: string; tag?: string; q?: string }) =>
    request(buildQuery('/subscriptions', params || {})),
  getSubscription: subscriptionsApi.get,
  getSubscriptionStats: () => request('/subscriptions/stats'),
  createSubscription: subscriptionsApi.create,
  updateSubscription: subscriptionsApi.update,
  deleteSubscription: subscriptionsApi.delete,

  // Context
  getContextEntries: () => request('/context'),
  getContext: (key: string) => request(`/context/${key}`),
  setContext: (key: string, value: string) =>
    request(`/context/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  deleteContext: (key: string) => request(`/context/${key}`, { method: 'DELETE' }),

  // Knowledge
  getKnowledge: (params?: { q?: string; page?: number; limit?: number }) =>
    request(buildQuery('/knowledge', {
      ...(params?.q ? { q: params.q } : {}),
      ...(params?.page ? { page: String(params.page) } : {}),
      ...(params?.limit ? { limit: String(params.limit) } : {}),
    })),
  getKnowledgeEntry: (id: string) => request(`/knowledge/${id}`),
  createKnowledge: (data: { content: string }) =>
    request('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  updateKnowledge: (id: string, data: { content?: string }) =>
    request(`/knowledge/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteKnowledge: (id: string) => request(`/knowledge/${id}`, { method: 'DELETE' }),

  // Repos
  getRepos: () => request('/repos'),
  getRepo: (id: string) => request(`/repos/${id}`),
  createRepo: (url: string) =>
    request('/repos', { method: 'POST', body: JSON.stringify({ url }) }),
  updateRepo: (id: string, data: Record<string, unknown>) =>
    request(`/repos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRepo: (id: string) => request(`/repos/${id}`, { method: 'DELETE' }),
  getRepoTasks: (id: string) => request(`/repos/${id}/tasks`),
  getTaskRepos: (taskId: string) => request(`/tasks/${taskId}/repos`),
  linkRepoToTask: (taskId: string, repoId: string) =>
    request(`/tasks/${taskId}/repos`, { method: 'POST', body: JSON.stringify({ repoId }) }),
  unlinkRepoFromTask: (taskId: string, repoId: string) =>
    request(`/tasks/${taskId}/repos/${repoId}`, { method: 'DELETE' }),
};
