import { ensureCsrfCookie, toApiError } from '@physio/api';

/** Multipart POST to the API with the Sanctum CSRF header (openapi-fetch does not serialise files). */
export async function uploadForm<T = unknown>(path: string, body: FormData): Promise<T> {
  await ensureCsrfCookie();
  const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.slice(11) ?? '');
  const res = await fetch(`/api${path}`, { method: 'POST', body, credentials: 'include', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token } });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}
