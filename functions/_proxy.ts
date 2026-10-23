// Forwards /api and /sanctum to the Laravel API so the browser sees one origin
// (session cookie + CSRF work with no CORS). API_ORIGIN is required: set it in
// Cloudflare Pages → Settings → Variables and Secrets (e.g. https://api.example.com).
interface Env {
  API_ORIGIN?: string;
}

export async function proxyToApi({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.API_ORIGIN) {
    return new Response('API_ORIGIN is not configured for this deployment.', { status: 503 });
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN);

  const headers = new Headers(request.headers);
  // The API sees Cloudflare's address otherwise, which would put every visitor in one rate-limit bucket.
  const visitor = request.headers.get('CF-Connecting-IP');
  if (visitor) headers.set('X-Forwarded-For', visitor);
  headers.set('X-Forwarded-Proto', 'https');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return fetch(target, { method: request.method, headers, body: hasBody ? request.body : undefined, redirect: 'manual' });
}
