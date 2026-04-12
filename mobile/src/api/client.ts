import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

async function request(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('token');
  const res = await fetch(`${API_URL}${path}`, {
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
  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { email: string; password: string; name: string; username: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  getTasks: (page = 1) => request(`/tasks?page=${page}&limit=20`),
  getTask: (id: string) => request(`/tasks/${id}`),
  createTask: (data: { title: string; description?: string; deadline?: string }) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Record<string, unknown>) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id: string) =>
    request(`/tasks/${id}`, { method: 'DELETE' }),
};
