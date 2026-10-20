import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

/**
 * Typed API client generated from the backend's OpenAPI document (Scramble).
 *
 * Auth is Sanctum's cookie session: no tokens ever touch JS storage.
 *  - credentials: 'include' sends the HttpOnly session cookie
 *  - unsafe methods carry X-XSRF-TOKEN read from the XSRF-TOKEN cookie
 *  - a 419 (expired CSRF token) refreshes the cookie and retries once
 */

export interface ValidationErrors {
  [field: string]: string[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly errors: ValidationErrors = {},
    public readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isValidation(): boolean {
    return this.status === 422 && Object.keys(this.errors).length > 0;
  }

  get conflicts(): Array<{ resource: string; appointment_id: number; local_start?: string }> {
    return (this.body.conflicts as never) ?? [];
  }

  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

type UnauthorizedHandler = (error: ApiError) => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/** Subscribe to 401s (e.g. redirect to sign-in). Returns an unsubscribe function. */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfPromise: Promise<void> | null = null;

export function ensureCsrfCookie(force = false): Promise<void> {
  if (!force && readCookie('XSRF-TOKEN')) return Promise.resolve();
  csrfPromise ??= fetch('/sanctum/csrf-cookie', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then(() => undefined)
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    request.headers.set('Accept', 'application/json');
    request.headers.set('X-Requested-With', 'XMLHttpRequest');
    if (UNSAFE.has(request.method)) {
      await ensureCsrfCookie();
      const token = readCookie('XSRF-TOKEN');
      if (token) request.headers.set('X-XSRF-TOKEN', token);
    }
    return request;
  },
};

export async function toApiError(response: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {};
  try {
    body = await response.clone().json();
  } catch {
    /* non-JSON error page, or body already consumed */
  }
  return apiErrorFrom(response, body);
}

/** Builds an ApiError from an already-parsed error body (openapi-fetch reads the body itself). */
export function apiErrorFrom(response: Response, parsed: unknown): ApiError {
  const body = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  return new ApiError(
    response.status,
    (body.message as string) || response.statusText || 'Request failed',
    body.code as string | undefined,
    (body.errors as ValidationErrors) ?? {},
    body,
  );
}

const errorMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (response.status === 419 && !request.headers.has('X-Retried')) {
      await ensureCsrfCookie(true);
      const retry = new Request(request, { headers: new Headers(request.headers) });
      retry.headers.set('X-Retried', '1');
      const token = readCookie('XSRF-TOKEN');
      if (token) retry.headers.set('X-XSRF-TOKEN', token);
      return fetch(retry);
    }
    if (response.status === 401) {
      const error = await toApiError(response);
      unauthorizedHandlers.forEach((handler) => handler(error));
    }
    return response;
  },
};

/** Laravel-style query strings: arrays as key[]=v, empty values dropped. */
export function serializeQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(`${key}[]`, String(v)));
    else if (typeof value === 'boolean') params.append(key, value ? '1' : '0');
    else params.append(key, String(value));
  }
  return params.toString();
}

export const api = createClient<paths>({ baseUrl: '/api', credentials: 'include', querySerializer: serializeQuery });
api.use(csrfMiddleware, errorMiddleware);

/**
 * Unwraps an openapi-fetch result: returns data or throws ApiError.
 * Usage: const me = await unwrap(api.GET('/auth/me'));
 */
export async function unwrap<T>(promise: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await promise;
  // openapi-fetch has already parsed (and consumed) the body; use its `error`.
  if (!response.ok) throw apiErrorFrom(response, error);
  return data as T;
}

/** For endpoints returning files (PDF/CSV): fetch with the session and trigger a download or open. */
export async function fetchBlob(path: string): Promise<Blob> {
  const response = await fetch(`/api${path}`, { credentials: 'include', headers: { Accept: '*/*' } });
  if (!response.ok) throw await toApiError(response);
  return response.blob();
}

export async function openFile(path: string, filename?: string): Promise<void> {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  if (filename) {
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
  } else {
    window.open(url, '_blank', 'noopener');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
