import type { Issue, IssueGeoJson, ApiError } from '@eco/shared';
import type { ResolvedSelection } from './components/ResolvedFilter';

const API_BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '');

export class ApiRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string,
    public readonly retryAfter?: number) { super(message); }
}

async function request<T>(route: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${route}`, { ...options, headers: {
      ...(!(options?.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    }});
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao servidor.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Partial<ApiError>;
    throw new ApiRequestError(response.status, body.error || 'UNKNOWN_ERROR',
      body.message || 'Não foi possível concluir a operação.', body.retryAfter);
  }
  return response.json() as Promise<T>;
}

export function publicMediaUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, new URL(API_BASE, window.location.origin).origin).toString();
}

export function fetchIssues(bounds: string, category: string, signal?: AbortSignal, resolved?:ResolvedSelection): Promise<IssueGeoJson> {
  const params = new URLSearchParams({ bbox: bounds });
  if (category !== 'all') params.set('category', category);
  if(resolved?.includeResolved){params.set('includeResolved','true');params.set('resolvedFrom',resolved.resolvedFrom);params.set('resolvedTo',resolved.resolvedTo);}
  return request(`/issues?${params}`, { signal });
}

export function fetchIssue(id: string): Promise<Issue> {
  return request<{ issue: Issue }>(`/issues/${encodeURIComponent(id)}`).then(r => r.issue);
}

export function fetchNearby(longitude: number, latitude: number, category: string, signal?: AbortSignal): Promise<Issue[]> {
  const params = new URLSearchParams({ longitude: String(longitude), latitude: String(latitude), category });
  return request<{ issues: Issue[] }>(`/issues/nearby?${params}`, { signal }).then(r => r.issues);
}

export function submitReport(data: FormData): Promise<Issue> {
  return request<{ issue: Issue }>('/reports', { method: 'POST', body: data }).then(r => r.issue);
}

export function confirmIssue(id: string): Promise<Issue> {
  return request<{ issue: Issue }>(`/issues/${encodeURIComponent(id)}/confirmations`, { method: 'POST', body: '{}' }).then(r => r.issue);
}
