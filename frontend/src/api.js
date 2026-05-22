import { supabase, supabaseEnabled } from './supabase.js';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

async function authHeaders() {
  if (supabaseEnabled) {
    const { data } = await supabase.auth.getSession();
    const tok = data?.session?.access_token;
    if (tok) return { Authorization: `Bearer ${tok}` };
  }
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.text();
    let parsed = body;
    try { parsed = JSON.parse(body); } catch {}
    const err = new Error(parsed?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  autocomplete: (type, q) =>
    request(`/api/v1/jobs/autocomplete?type=${type}&q=${encodeURIComponent(q)}`),
  searchJobs: (params) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') q.set(k, v);
    });
    return request(`/api/v1/jobs/search?${q}`);
  },
  homeJobs: (city, pageSize = 5) => {
    const q = new URLSearchParams({ pageSize });
    if (city) q.set('city', city);
    return request(`/api/v1/jobs?${q}`);
  },
  jobDetail: (id) => request(`/api/v1/jobs/${id}`),
  related: (id) => request(`/api/v1/jobs/${id}/related`),
  apply: (id) => request(`/api/v1/jobs/${id}/apply`, { method: 'POST' }),
  recentSearches: () => request('/api/v1/searches/recent'),

  adminListJobs: (page = 1) => request(`/api/v1/admin/jobs?page=${page}`),
  adminCreateJob: (data) => request('/api/v1/admin/jobs', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateJob: (id, data) => request(`/api/v1/admin/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDeleteJob: (id) => request(`/api/v1/admin/jobs/${id}`, { method: 'DELETE' }),

  listAlerts: () => request('/api/v1/notifications/alerts'),
  createAlert: (data) => request('/api/v1/notifications/alerts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAlert: (id) => request(`/api/v1/notifications/alerts/${id}`, { method: 'DELETE' }),

  chat: (messages) => request('/api/v1/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
};
