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
  getTasks: (page = 1, limit = 20) => request(`/tasks?page=${page}&limit=${limit}`),
  getTask: (id: string) => request(`/tasks/${id}`),
  getBlocking: (id: string) => request(`/tasks/${id}/blocking`),
  getCalendar: (from: string, to: string) => request(`/tasks/calendar?from=${from}&to=${to}`),
  createTask: (data: { title: string; description?: string; visibility?: string; groupIds?: string[]; blockedBy?: string[]; deadline?: string; recurrence?: { freq: string; interval: number } | null }) =>
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
};
