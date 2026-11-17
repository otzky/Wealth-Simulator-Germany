// Vercel Function: hosted MCP server at /api/mcp (Streamable HTTP). Access key: ?key=<SITE_PASSWORD>.
import { handleMcp } from '../agent/remote.js';

export default { fetch: handleMcp };
