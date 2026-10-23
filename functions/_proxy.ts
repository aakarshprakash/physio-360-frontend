// Forwards /api and /sanctum to the Laravel API so the browser sees one origin
// (session cookie + CSRF work with no CORS). Set API_ORIGIN in Pages → Settings → Variables to override.
const DEFAULT_API_ORIGIN = 'https://api.physio.peoplenex.online';

interface Env {
  API_ORIGIN?: string;
}

export async function proxyToApi({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN ?? DEFAULT_API_ORIGIN);

  const headers = new Headers(request.headers);
  // The API sees Cloudflare's address otherwise, which would put every visitor in one rate-limit bucket.
  const visitor = request.headers.get('CF-Connecting-IP');
  if (visitor) headers.set('X-Forwarded-For', visitor);
  headers.set('X-Forwarded-Proto', 'https');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return fetch(target, { method: request.method, headers, body: hasBody ? request.body : undefined, redirect: 'manual' });
}
