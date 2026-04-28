/**
 * REST API client for the Canvas UI Platform server.
 * Wraps fetch with base URL, auth headers, and JSON handling.
 */

// When served through HA ingress the URL is /api/hassio_ingress/<token>/...
// API calls must be prefixed with that base so they route through ingress.
export function getApiBase(): string {
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
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
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
  patch: (id: string, data: Partial<Device>) => api.patch<Device>(`/api/devices/${id}`, data),
  assignView: (deviceId: string, viewId: string) =>
    api.post<void>(`/api/devices/${deviceId}/assign-view`, { viewId }),
};

// ── Pages ──────────────────────────────────────────────────────────────────────

import type { Page } from '../types';

export type PageCreate = { name: string; canvas_view_id?: string | null };
export type PageUpdate = Partial<PageCreate>;

export const pagesApi = {
  list: () => api.get<Page[]>('/api/pages'),
  get: (id: string) => api.get<Page>(`/api/pages/${id}`),
  create: (data: PageCreate) => api.post<Page>('/api/pages', data),
  update: (id: string, data: PageUpdate) => api.patch<Page>(`/api/pages/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/pages/${id}`),
  push: (id: string) => api.post<{ pushed_to: number }>(`/api/pages/${id}/push`),
};

// ── Server ────────────────────────────────────────────────────────────────────

export const serverApi = {
  status: () => api.get<{ version: string; uptime: number; views: number; devices: number }>('/api/status'),
};

// ── HA Proxy ──────────────────────────────────────────────────────────────────

export interface HaEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
}

export const haApi = {
  states: () => api.get<HaEntityState[]>('/api/ha/states'),
};
