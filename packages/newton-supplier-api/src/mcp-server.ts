import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { NewtonSupplierService } from "./service.js";
import { SupplierFields } from "./types.js";

const service = new NewtonSupplierService(loadConfig());

const server = new McpServer({
  name: "newton-supplier-api",
  version: "0.1.0"
});

function asText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

const fieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean()])).optional();

server.tool(
  "newton_supplier_call",
  {
    operation: z.string().min(1),
    fields: fieldsSchema,
    rawBodyXml: z.string().optional(),
    soapAction: z.string().optional()
  },
  async ({ operation, fields, rawBodyXml, soapAction }) =>
    asText(
      await service.callOperation({
        operation,
        fields: fields as SupplierFields | undefined,
        rawBodyXml,
        soapAction
      })
    )
);

server.tool(
  "newton_supplier_get",
  {
    fields: fieldsSchema
  },
  async ({ fields }) =>
    asText(await service.getReferrals(fields as SupplierFields | undefined))
);

server.tool(
  "newton_supplier_ack",
  {
    fields: fieldsSchema
  },
  async ({ fields }) =>
    asText(await service.acknowledgeReferral(fields as SupplierFields | undefined))
);

const transport = new StdioServerTransport();
await server.connect(transport);
