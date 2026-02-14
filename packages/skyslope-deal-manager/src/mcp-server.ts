import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { DealManagerService } from "./service.js";

const cfg = loadConfig();
const svc = new DealManagerService(cfg);

const server = new McpServer({
  name: "skyslope-deal-manager",
  version: "0.1.0"
});

server.tool(
  "skyslope_sync_transaction",
  { transactionId: z.string().min(1) },
  async ({ transactionId }) => {
    const deal = await svc.syncTransaction(transactionId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(deal, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "skyslope_ingest_document_text",
  {
    dealId: z.string().min(1),
    filename: z.string().optional(),
    category: z.string().optional(),
    text: z.string().min(1)
  },
  async ({ dealId, filename, category, text }) => {
    const doc = await svc.ingestDocument({
      dealId,
      filename,
      category,
      text
    });
    return {
      content: [{ type: "text", text: JSON.stringify(doc, null, 2) }]
    };
  }
);

server.tool(
  "skyslope_ingest_document_pdf",
  {
    dealId: z.string().min(1),
    filePath: z.string().min(1),
    category: z.string().optional()
  },
  async ({ dealId, filePath, category }) => {
    const doc = await svc.ingestPdfFile({
      dealId,
      filePath,
      category
    });
    return {
      content: [{ type: "text", text: JSON.stringify(doc, null, 2) }]
    };
  }
);

server.tool(
  "skyslope_validate_deal_name",
  { name: z.string() },
  async ({ name }) => {
    const result = svc.validateNaming(name);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

server.tool(
  "skyslope_suggest_deal_name",
  {
    address: z.string().min(3),
    type: z.enum(["APS", "OTP", "LEASE", "LISTING", "AMENDMENT", "OTHER"])
  },
  async ({ address, type }) => {
    const suggested = svc.suggestNaming(address, type);
    return {
      content: [{ type: "text", text: JSON.stringify({ suggested }, null, 2) }]
    };
  }
);

server.tool(
  "skyslope_query_local_deals",
  { query: z.string().min(1) },
  async ({ query }) => {
    const results = svc.queryDeals(query);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
    };
  }
);

server.tool(
  "skyslope_get_deal_bundle",
  { dealId: z.string().min(1) },
  async ({ dealId }) => {
    const out = {
      deal: svc.getDeal(dealId),
      documents: svc.listDocumentsForDeal(dealId)
    };
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
