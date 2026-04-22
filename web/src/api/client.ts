/**
 * REST API client for the Canvas UI Platform server.
 * Wraps fetch with base URL, auth headers, and JSON handling.
 */

// When served through HA ingress the URL is /api/hassio_ingress/<token>/...
// API calls must be prefixed with that base so they route through ingress.
function getApiBase(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const match = window.location.pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
  return match ? match[1] : '';
}

const BASE = getApiBase();

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = localStorage.getItem('cui_token');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as unknown as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// ── Views ─────────────────────────────────────────────────────────────────────

import type { ServerView, ViewConfig } from '../types';

export const viewsApi = {
  list: () => api.get<ServerView[]>('/api/views'),
  get: (id: string) => api.get<ServerView>(`/api/views/${id}`),
  create: (data: { name: string; description?: string; view_data: ViewConfig }) =>
    api.post<ServerView>('/api/views', data),
  update: (id: string, data: Partial<{ name: string; description?: string; view_data: ViewConfig }>) =>
    api.put<ServerView>(`/api/views/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/views/${id}`),
  duplicate: (id: string) => api.post<ServerView>(`/api/views/${id}/duplicate`),
};

// ── Devices ───────────────────────────────────────────────────────────────────

import type { Device } from '../types';

export const devicesApi = {
  list: () => api.get<Device[]>('/api/devices'),
  get: (id: string) => api.get<Device>(`/api/devices/${id}`),
  assignView: (deviceId: string, viewId: string) =>
    api.post<void>(`/api/devices/${deviceId}/assign-view`, { viewId }),
};

// ── Server ────────────────────────────────────────────────────────────────────

export const serverApi = {
  status: () => api.get<{ version: string; uptime: number; views: number; devices: number }>('/api/status'),
};
