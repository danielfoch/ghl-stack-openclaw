import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { RealtorBridgeService } from "./service.js";

const service = new RealtorBridgeService(loadConfig());

const providerSchema = z.enum(["nexone", "faltour", "lonewolf"]);
const resourceSchema = z.enum([
  "offers",
  "folders",
  "documents",
  "listings",
  "contacts",
  "custom"
]);
const entitySchema = z.enum([
  "contact",
  "listing",
  "offer",
  "transaction",
  "document",
  "custom"
]);

const server = new McpServer({
  name: "openclaw-realtor-bridge",
  version: "0.1.0"
});

function asText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

server.tool(
  "openclaw_bridge_health",
  {
    provider: providerSchema
  },
  async ({ provider }) => asText(await service.health(provider))
);

server.tool(
  "openclaw_bridge_pull",
  {
    provider: providerSchema,
    resource: resourceSchema,
    userId: z.string().optional(),
    filter: z.string().optional(),
    cursor: z.string().optional(),
    cursorKey: z.string().optional(),
    limit: z.number().int().positive().optional()
  },
  async ({ provider, resource, userId, filter, cursor, cursorKey, limit }) =>
    asText(
      await service.pull(
        provider,
        {
          resource,
          userId,
          filter,
          cursor,
          limit
        },
        cursorKey
      )
    )
);

server.tool(
  "openclaw_bridge_push",
  {
    provider: providerSchema,
    eventId: z.string().optional(),
    entityType: entitySchema,
    payload: z.record(z.unknown())
  },
  async ({ provider, eventId, entityType, payload }) =>
    asText(
      await service.push(provider, {
        id: eventId,
        entityType,
        payload
      })
    )
);

server.tool(
  "openclaw_bridge_fanout",
  {
    providers: z.array(providerSchema).min(1),
    eventId: z.string().optional(),
    entityType: entitySchema,
    payload: z.record(z.unknown())
  },
  async ({ providers, eventId, entityType, payload }) =>
    asText(
      await service.fanout(providers, {
        id: eventId,
        entityType,
        payload
      })
    )
);

server.tool(
  "openclaw_bridge_recent_events",
  {
    limit: z.number().int().positive().optional()
  },
  async ({ limit }) => asText(service.recentEvents(limit ?? 25))
);

const transport = new StdioServerTransport();
await server.connect(transport);
