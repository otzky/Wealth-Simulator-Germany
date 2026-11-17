import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { setting } from './env.js';
import { createServer } from './mcp.js';
import { MemoryPlanStore } from './store.js';
import { AgentTools } from './tools.js';

/**
 * Hosted MCP endpoint (Streamable HTTP, stateless): every request gets a fresh server and nothing is stored.
 * Access needs the key from the environment variable SITE_PASSWORD, as ?key=… or "Authorization: Bearer …".
 * Request contents are never logged.
 */
export async function handleMcp(request: Request): Promise<Response> {
  const password = setting(process.env.SITE_PASSWORD);
  if (!password) return text(503, 'Nicht eingerichtet: Umgebungsvariable SITE_PASSWORD fehlt.');
  const url = new URL(request.url);
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if ((url.searchParams.get('key') ?? bearer) !== password) return text(401, 'Zugang nur mit Schlüssel.');

  const appBase = setting(process.env.WEALTH_SIM_APP_URL) ?? `${url.origin}/`;
  const tools = new AgentTools(new MemoryPlanStore(), appBase, true);
  const server = createServer(tools, { remote: true });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

const text = (status: number, body: string) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
