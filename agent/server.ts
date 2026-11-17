import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './mcp';
import { FilePlanStore } from './store';
import { AgentTools } from './tools';

/** Local MCP server over stdio (Claude Desktop, .mcpb extension). */
export async function main() {
  const server = createServer(new AgentTools(new FilePlanStore()));
  await server.connect(new StdioServerTransport());
}
