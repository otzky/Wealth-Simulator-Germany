// Vercel Routing Middleware: simple password lock for the app (browser login dialog).
// The password is not in the code: it comes from the environment variable SITE_PASSWORD in the Vercel project.
// /api/mcp checks the same password itself (as ?key=…), because MCP clients cannot answer a login dialog.
import { next } from '@vercel/functions';

export const config = { matcher: '/((?!api/).*)' };

export default function middleware(request: Request) {
  const password = process.env.SITE_PASSWORD?.trim();
  if (!password) return new Response('Nicht eingerichtet: Umgebungsvariable SITE_PASSWORD fehlt.', { status: 503 });
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      if (decoded.slice(decoded.indexOf(':') + 1) === password) return next();
    } catch {
      // malformed header: ask again
    }
  }
  return new Response('Passwort erforderlich.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Vermoegens-Simulator", charset="UTF-8"', 'content-type': 'text/plain; charset=utf-8' },
  });
}
