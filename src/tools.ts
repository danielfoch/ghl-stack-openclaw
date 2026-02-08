import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { LRUCache } from "lru-cache";
import { z } from "zod";
import type { Config } from "./config.js";
import { DdfClient } from "./ddfClient.js";
import { createLogger } from "./logger.js";
import { propertyKeyPath, toPropertyFilter, escODataString } from "./odata.js";
import {
  intersectSelect,
  MEDIA_SAFE_FIELDS,
  PROPERTY_SAFE_DETAIL_FIELDS,
  PROPERTY_SAFE_SUMMARY_FIELDS,
  parseOrderBy,
} from "./policy.js";

function ok(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text }] };
}

function toolError(message: string, details?: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message, details }, null, 2),
      },
    ],
  };
}

export function registerTools(server: McpServer, cfg: Config) {
  const log = createLogger(cfg.LOG_LEVEL);
  const client = new DdfClient(cfg);
  const metaCache = new LRUCache<string, unknown>({ max: 4, ttl: 1000 * 60 * 60 });

  server.tool(
    "ddf.search_properties",
    "Search DDF Property records using strict, compliance-safe filters and field allowlists.",
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
          updatedSince: z.string().optional(), // ISO 8601
        })
        .optional(),
      top: z.number().int().min(1).default(cfg.DDF_DEFAULT_TOP).max(cfg.DDF_MAX_TOP),
      skip: z.number().int().min(0).default(0),
      select: z.array(z.string()).optional(),
      orderBy: z.string().optional(),
      includeCount: z.boolean().optional().default(true),
    },
    async ({ filters, top, skip, select, orderBy, includeCount }) => {
      const callId = randomUUID();
      try {
        log.info("tool_call", { callId, tool: "ddf.search_properties" });
        if (cfg.LOG_TOOL_ARGS) log.debug("tool_args", { callId, tool: "ddf.search_properties", args: { filters, top, skip } });

        const $filter = toPropertyFilter(filters);
        const $select = intersectSelect(select, PROPERTY_SAFE_SUMMARY_FIELDS).join(",");

        const order = parseOrderBy(orderBy, PROPERTY_SAFE_SUMMARY_FIELDS);
        if (!order.ok) return toolError(order.error);

        const json = (await client.get("/Property", {
          ...($filter ? { $filter } : {}),
          $top: String(top),
          $skip: String(skip),
          $select,
          ...(order.value ? { $orderby: order.value } : {}),
          ...(includeCount ? { $count: "true" } : {}),
        })) as any;

        return ok({
          count: json?.["@odata.count"],
          next: { top, skip: skip + top },
          odata: {
            nextLink: json?.["@odata.nextLink"],
          },
          results: json?.value ?? json,
        });
      } catch (e: any) {
        log.error("tool_error", { callId, tool: "ddf.search_properties", err: String(e?.message ?? e) });
        return toolError("DDF request failed", { callId, message: String(e?.message ?? e) });
      }
    }
  );

  server.tool(
    "ddf.get_property",
    "Fetch one Property by ListingKey with field allowlists.",
    {
      id: z.string(),
      select: z.array(z.string()).optional(),
      detail: z.boolean().optional().default(true),
    },
    async ({ id, select, detail }) => {
      const callId = randomUUID();
      try {
        log.info("tool_call", { callId, tool: "ddf.get_property" });
        if (cfg.LOG_TOOL_ARGS) log.debug("tool_args", { callId, tool: "ddf.get_property", args: { id, detail } });

        const allow = detail ? PROPERTY_SAFE_DETAIL_FIELDS : PROPERTY_SAFE_SUMMARY_FIELDS;
        const $select = intersectSelect(select, allow).join(",");
        const json = await client.get(propertyKeyPath(id, cfg.DDF_PROPERTY_KEY_STYLE), { $select });
        return ok(json);
      } catch (e: any) {
        log.error("tool_error", { callId, tool: "ddf.get_property", err: String(e?.message ?? e) });
        return toolError("DDF request failed", { callId, message: String(e?.message ?? e) });
      }
    }
  );

  server.tool(
    "ddf.get_property_media",
    "Fetch media for a property. Endpoint varies by deployment; configure via env vars.",
    {
      id: z.string(),
      top: z.number().int().min(1).max(cfg.DDF_MAX_TOP).optional().default(100),
      skip: z.number().int().min(0).optional().default(0),
      select: z.array(z.string()).optional(),
    },
    async ({ id, top, skip, select }) => {
      const callId = randomUUID();
      try {
        log.info("tool_call", { callId, tool: "ddf.get_property_media" });
        if (cfg.LOG_TOOL_ARGS) log.debug("tool_args", { callId, tool: "ddf.get_property_media", args: { id, top, skip } });

        const $select = intersectSelect(select, MEDIA_SAFE_FIELDS).join(",");

        const recordKeyField = cfg.DDF_MEDIA_RECORD_KEY_FIELD;
        const orderField = cfg.DDF_MEDIA_ORDER_FIELD;
        const entity = cfg.DDF_MEDIA_ENTITY;

        const $filter = `${recordKeyField} eq '${escODataString(id)}'`;
        const json = await client.get(`/${entity}`, {
          $filter,
          $top: String(top),
          $skip: String(skip),
          $select,
          $orderby: `${orderField} asc`,
        });
        return ok(json);
      } catch (e: any) {
        log.error("tool_error", { callId, tool: "ddf.get_property_media", err: String(e?.message ?? e) });
        return toolError("DDF request failed", { callId, message: String(e?.message ?? e) });
      }
    }
  );

  server.tool("ddf.get_metadata", "Fetch raw OData $metadata for schema discovery. Cached server-side.", {}, async () => {
    const callId = randomUUID();
    try {
      log.info("tool_call", { callId, tool: "ddf.get_metadata" });
      // Note: intentionally no arbitrary path parameter; this prevents bypassing field allowlists.
      const cached = metaCache.get("edmx");
      if (cached) return ok(cached);
      const json = await client.get("/$metadata");
      metaCache.set("edmx", json);
      return ok(json);
    } catch (e: any) {
      log.error("tool_error", { callId, tool: "ddf.get_metadata", err: String(e?.message ?? e) });
      return toolError("DDF request failed", { callId, message: String(e?.message ?? e) });
    }
  });
}
