import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { registerTools } from "./tools.js";

const cfg = loadConfig(process.env);
const log = createLogger(cfg.LOG_LEVEL);
const server = new McpServer({ name: "crea-ddf-mcp", version: "0.2.0" });

registerTools(server, cfg);

async function main() {
  log.info("startup", { name: "crea-ddf-mcp", version: "0.2.0", baseUrl: cfg.DDF_BASE_URL, grant: cfg.DDF_TOKEN_GRANT });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
