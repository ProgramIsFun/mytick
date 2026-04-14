import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

let _apiUrl = DEFAULT_API_URL;

export async function initApiUrl() {
  const saved = await SecureStore.getItemAsync('debug_api_url');
  if (saved) _apiUrl = saved;
}

export function getApiUrl() { return _apiUrl; }
export function getDefaultApiUrl() { return DEFAULT_API_URL; }

export async function setApiUrl(url: string) {
  _apiUrl = url;
  await SecureStore.setItemAsync('debug_api_url', url);
}

export async function resetApiUrl() {
  _apiUrl = DEFAULT_API_URL;
  await SecureStore.deleteItemAsync('debug_api_url');
}

async function request(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('token');
  const url = `${_apiUrl}${path}`;
  try {
    const res = await fetch(url, {
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
  } catch (e: any) {
    if (e.message === 'Network request failed') {
      throw new Error(`Network request failed\n\nURL: ${url}\n\nCheck:\n• Backend running?\n• Same WiFi?\n• Correct IP?`);
    }
    throw e;
  }
}

export const api = {
  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { email: string; password: string; name: string; username: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  getTasks: (page = 1) => request(`/tasks?page=${page}&limit=20`),
  getTask: (id: string) => request(`/tasks/${id}`),
  getBlocking: (id: string) => request(`/tasks/${id}/blocking`),
  createTask: (data: { title: string; description?: string; deadline?: string }) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Record<string, unknown>) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id: string) =>
    request(`/tasks/${id}`, { method: 'DELETE' }),
  rollbackDescription: (id: string, index: number) =>
    request(`/tasks/${id}/rollback/${index}`, { method: 'POST' }),
  updateMe: (data: { username?: string; name?: string; newPassword?: string }) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  registerFcmToken: (fcmToken: string) =>
    request('/auth/fcm-token', { method: 'POST', body: JSON.stringify({ fcmToken }) }),
  removeFcmToken: (fcmToken: string) =>
    request('/auth/fcm-token', { method: 'DELETE', body: JSON.stringify({ fcmToken }) }),
  getGroups: () => request('/groups'),
  createGroup: (name: string) =>
    request('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  addGroupMember: (groupId: string, email: string, role = 'viewer') =>
    request(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ email, role }) }),
  removeGroupMember: (groupId: string, userId: string) =>
    request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  deleteGroup: (groupId: string) =>
    request(`/groups/${groupId}`, { method: 'DELETE' }),
  testPush: () =>
    request('/auth/test-push', { method: 'POST' }),
};
