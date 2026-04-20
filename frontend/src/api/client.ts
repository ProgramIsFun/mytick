const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
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

export const api = {
  // Auth
  register: (data: { email: string; password: string; name: string; username: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  updateMe: (data: { username?: string; name?: string; newPassword?: string }) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Tasks
  getTasks: (page = 1, limit = 20, type?: string, tag?: string, q?: string) => {
    let url = `/tasks?page=${page}&limit=${limit}`;
    if (type) url += `&type=${type}`;
    if (tag) url += `&tag=${encodeURIComponent(tag)}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    return request(url);
  },
  getTask: (id: string) => request(`/tasks/${id}`),
  getBlocking: (id: string) => request(`/tasks/${id}/blocking`),
  getSubtasks: (id: string) => request(`/tasks/${id}/subtasks`),
  getProfile: (username: string) => request(`/tasks/u/${username}/profile`),
  getCalendar: (from: string, to: string) => request(`/tasks/calendar?from=${from}&to=${to}`),
  createTask: (data: { title: string; description?: string; visibility?: string; groupIds?: string[]; blockedBy?: string[]; parentId?: string; deadline?: string; recurrence?: { freq: string; interval: number } | null; type?: string; tags?: string[]; metadata?: Record<string, unknown> | null }) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Record<string, unknown>) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  markOccurrence: (id: string, date: string, status: 'done' | 'skipped') =>
    request(`/tasks/${id}/occurrences`, { method: 'POST', body: JSON.stringify({ date, status }) }),
  editOccurrence: (id: string, date: string, overrides: { newDate?: string; title?: string; description?: string }) =>
    request(`/tasks/${id}/occurrences`, { method: 'POST', body: JSON.stringify({ date, status: 'pending', ...overrides }) }),
  revertOccurrence: (id: string, date: string) =>
    request(`/tasks/${id}/occurrences`, { method: 'DELETE', body: JSON.stringify({ date }) }),
  endSeries: (id: string, date: string) =>
    request(`/tasks/${id}/end-series`, { method: 'POST', body: JSON.stringify({ date }) }),
  rollbackDescription: (id: string, index: number) =>
    request(`/tasks/${id}/rollback/${index}`, { method: 'POST' }),
  deleteTask: (id: string) =>
    request(`/tasks/${id}`, { method: 'DELETE' }),
  getSharedTask: (token: string) =>
    request(`/tasks/share/${token}`),
  getPublicTasks: (userId: string) =>
    request(`/tasks/user/${userId}`),
  getPublicTasksByUsername: (username: string) =>
    request(`/tasks/u/${username}`),

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
  deleteGroup: (groupId: string) =>
    request(`/groups/${groupId}`, { method: 'DELETE' }),

  // FCM
  registerFcmToken: (fcmToken: string) =>
    request('/auth/fcm-token', { method: 'POST', body: JSON.stringify({ fcmToken }) }),
  removeFcmToken: (fcmToken: string) =>
    request('/auth/fcm-token', { method: 'DELETE', body: JSON.stringify({ fcmToken }) }),
  testPush: (tokenIndex?: number) =>
    request('/auth/test-push', { method: 'POST', body: JSON.stringify(tokenIndex !== undefined ? { tokenIndex } : {}) }),
  getFcmTokens: () =>
    request('/auth/fcm-tokens'),

  // Accounts
  getAccounts: (q?: string, tag?: string) => {
    let url = '/accounts';
    const params = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (tag) params.push(`tag=${encodeURIComponent(tag)}`);
    if (params.length) url += '?' + params.join('&');
    return request(url);
  },
  getAccount: (id: string) => request(`/accounts/${id}`),
  createAccount: (data: Record<string, unknown>) =>
    request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: Record<string, unknown>) =>
    request(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id: string) =>
    request(`/accounts/${id}`, { method: 'DELETE' }),

  // Domains
  getDomains: (q?: string, tag?: string, projectId?: string) => {
    let url = '/domains';
    const params = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (tag) params.push(`tag=${encodeURIComponent(tag)}`);
    if (projectId) params.push(`projectId=${projectId}`);
    if (params.length) url += '?' + params.join('&');
    return request(url);
  },
  getDomain: (id: string) => request(`/domains/${id}`),
  createDomain: (data: Record<string, unknown>) =>
    request('/domains', { method: 'POST', body: JSON.stringify(data) }),
  updateDomain: (id: string, data: Record<string, unknown>) =>
    request(`/domains/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDomain: (id: string) =>
    request(`/domains/${id}`, { method: 'DELETE' }),
};
