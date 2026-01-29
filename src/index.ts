import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Starting MCP QA Server...");

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("MCP QA Server is running on stdio");
}

main().catch((err) => {
  logger.error("Fatal error starting MCP QA Server", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
