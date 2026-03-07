import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { JsonObject } from "./client.js";
import { NewtonLinkService } from "./service.js";

const service = new NewtonLinkService(loadConfig());

const server = new McpServer({
  name: "newton-lender-link",
  version: "0.1.0"
});

function asText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

const payloadSchema = z.record(z.unknown());

server.tool(
  "newton_link_lender_details",
  {
    unitId: z.string().optional(),
    posSystemId: z.string().optional()
  },
  async ({ unitId, posSystemId }) => asText(await service.lenderDetails({ unitId, posSystemId }))
);

server.tool(
  "newton_link_submit_application",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.submitApplication(payload as JsonObject))
);

server.tool(
  "newton_link_validate_application",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.validateApplication(payload as JsonObject))
);

server.tool(
  "newton_link_submit_document",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.submitDocument(payload as JsonObject))
);

server.tool(
  "newton_link_pending_applications",
  {
    unitId: z.string().optional(),
    posSystemId: z.string().optional()
  },
  async ({ unitId, posSystemId }) =>
    asText(await service.pendingApplications({ unitId, posSystemId }))
);

server.tool(
  "newton_link_search_application_decisions",
  { payload: payloadSchema },
  async ({ payload }) =>
    asText(await service.searchApplicationDecisions(payload as JsonObject))
);

server.tool(
  "newton_link_acknowledge_application_decision",
  { payload: payloadSchema },
  async ({ payload }) =>
    asText(await service.acknowledgeApplicationDecision(payload as JsonObject))
);

server.tool(
  "newton_link_update_application_status",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.updateApplicationStatus(payload as JsonObject))
);

server.tool(
  "newton_link_update_compliance_status",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.updateComplianceStatus(payload as JsonObject))
);

server.tool(
  "newton_link_credit_bureau_equifax",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.creditBureauEquifax(payload as JsonObject))
);

server.tool(
  "newton_link_credit_bureau_transunion",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.creditBureauTransunion(payload as JsonObject))
);

server.tool(
  "newton_link_submit_life_insurance",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.submitLifeInsurance(payload as JsonObject))
);

server.tool(
  "newton_link_life_insurance_status",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.lifeInsuranceStatus(payload as JsonObject))
);

server.tool(
  "newton_link_acknowledge_life_insurance_status",
  { payload: payloadSchema },
  async ({ payload }) =>
    asText(await service.acknowledgeLifeInsuranceStatus(payload as JsonObject))
);

server.tool(
  "newton_link_property_valuation",
  { payload: payloadSchema },
  async ({ payload }) => asText(await service.propertyValuation(payload as JsonObject))
);

const transport = new StdioServerTransport();
await server.connect(transport);
