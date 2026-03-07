import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { DdfService } from "./service.js";

function asMcpText(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text" as const, text }]
  };
}

function asMcpError(message: string, details?: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, details }, null, 2)
      }
    ]
  };
}

const config = loadConfig();
const service = new DdfService(config);

const server = new McpServer({
  name: "crea-ddf-mcp",
  version: "0.1.0"
});

server.tool(
  "ddf.search_properties",
  {
    filters: z
      .object({
        city: z.string().optional(),
        province: z.string().optional(),
        postalCode: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minBeds: z.number().optional(),
        minBaths: z.number().optional(),
        status: z.string().optional(),
        updatedSince: z.string().optional()
      })
      .optional(),
    top: z.number().int().min(1).max(config.maxTop).optional(),
    skip: z.number().int().min(0).optional(),
    select: z.array(z.string()).optional(),
    orderBy: z.string().optional(),
    includeCount: z.boolean().optional()
  },
  async (input) => {
    try {
      return asMcpText(await service.searchProperties(input));
    } catch (error) {
      return asMcpError("search failed", error instanceof Error ? error.message : String(error));
    }
  }
);

server.tool(
  "ddf.get_property",
  {
    id: z.string().min(1),
    detail: z.boolean().optional(),
    select: z.array(z.string()).optional()
  },
  async (input) => {
    try {
      return asMcpText(await service.getProperty(input));
    } catch (error) {
      return asMcpError("get_property failed", error instanceof Error ? error.message : String(error));
    }
  }
);

server.tool(
  "ddf.get_property_media",
  {
    id: z.string().min(1),
    top: z.number().int().min(1).max(config.maxTop).optional(),
    skip: z.number().int().min(0).optional(),
    select: z.array(z.string()).optional()
  },
  async (input) => {
    try {
      return asMcpText(await service.getPropertyMedia(input));
    } catch (error) {
      return asMcpError("get_property_media failed", error instanceof Error ? error.message : String(error));
    }
  }
);

server.tool("ddf.get_metadata", {}, async () => {
  try {
    return asMcpText(await service.getMetadata());
  } catch (error) {
    return asMcpError("get_metadata failed", error instanceof Error ? error.message : String(error));
  }
});

server.tool(
  "ddf.raw_request",
  {
    method: z.enum(["GET", "POST"]),
    path: z.string().min(1),
    query: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    body: z.record(z.unknown()).nullable().optional(),
    auth: z.boolean().optional().default(true)
  },
  async ({ method, path, query, body, auth }) => {
    try {
      return asMcpText(await service.rawRequest({ method, path, query, body, auth }));
    } catch (error) {
      return asMcpError("raw_request failed", error instanceof Error ? error.message : String(error));
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
