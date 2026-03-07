import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VelocityService } from "./service.js";

const service = new VelocityService();

const server = new McpServer({
  name: "velocity-mortgage",
  version: "0.1.0"
});

function asText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

server.tool(
  "velocity_contact_create",
  {
    payload: z.record(z.unknown())
  },
  async ({ payload }) => asText(await service.createContact(payload))
);

server.tool("velocity_contact_sample", {}, async () =>
  asText(await service.getSampleContact())
);

server.tool(
  "velocity_deal_create",
  {
    payload: z.record(z.unknown())
  },
  async ({ payload }) => asText(await service.createDeal(payload))
);

server.tool("velocity_deal_sample", {}, async () => asText(await service.getSampleDeal()));

server.tool(
  "velocity_deals_get",
  {
    dealstatus: z.string().optional(),
    customsource: z.string().optional(),
    datetype: z.number().int().optional(),
    startdate: z.string().optional(),
    enddate: z.string().optional(),
    loancode: z.string().optional(),
    page: z.number().int().optional()
  },
  async (query) => asText(await service.getDeals(query))
);

server.tool(
  "velocity_deals_search",
  {
    payload: z.record(z.unknown())
  },
  async ({ payload }) => asText(await service.searchDeals(payload))
);

server.tool(
  "velocity_raw_request",
  {
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().min(1),
    query: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    body: z.record(z.unknown()).optional()
  },
  async ({ method, path, query, body }) =>
    asText(await service.request(method, path, query, body))
);

const transport = new StdioServerTransport();
await server.connect(transport);
