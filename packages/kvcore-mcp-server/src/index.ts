import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KvCoreAdapter, createTwilioCall, loadKvCoreConfig } from "@fub/adapters-kvcore";

const kvcore = new KvCoreAdapter(loadKvCoreConfig(process.env));

const server = new McpServer({
  name: "kvcore-mcp-server",
  version: "0.1.0"
});

server.tool(
  "kvcore_capabilities",
  "Describe supported KVcore public API automations and fallback integrations.",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        kvcore_supported: [
          "contact search/get/create/update",
          "contact tags add/remove",
          "contact notes add/list",
          "log call activity",
          "send email to contact (kvcore endpoint)",
          "send text to contact (kvcore endpoint)",
          "schedule call",
          "user tasks list",
          "user calls list",
          "refresh campaigns (superaccount endpoint)",
          "raw endpoint access"
        ],
        kvcore_not_exposed_in_public_v2: [
          "generic workflow builder/automation CRUD",
          "task create/update/complete APIs"
        ],
        fallbacks: [
          "Twilio direct call creation via twilio_call_create",
          "Use raw tool for any newly published KVcore endpoint"
        ]
      })
    }]
  })
);

server.tool(
  "kvcore_request",
  "Raw KVcore API request against https://api.kvcore.com.",
  {
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().min(1),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.any().optional()
  },
  async ({ method, path, query, body }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.raw({ method, path, query, body })) }]
  })
);

server.tool(
  "kvcore_contact_search",
  "Search contacts in KVcore.",
  {
    query: z.string().optional(),
    page: z.number().int().positive().optional(),
    per_page: z.number().int().positive().optional()
  },
  async ({ query, page, per_page }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.searchContacts(query, page, per_page)) }]
  })
);

server.tool(
  "kvcore_contact_get",
  "Get a KVcore contact by id.",
  {
    contact_id: z.number().int().positive()
  },
  async ({ contact_id }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.getContact(contact_id)) }]
  })
);

server.tool(
  "kvcore_contact_create",
  "Create a KVcore contact using raw contact payload fields.",
  {
    contact: z.record(z.string(), z.any())
  },
  async ({ contact }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.createContact(contact)) }]
  })
);

server.tool(
  "kvcore_contact_update",
  "Update a KVcore contact using raw payload fields.",
  {
    contact_id: z.number().int().positive(),
    contact: z.record(z.string(), z.any())
  },
  async ({ contact_id, contact }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.updateContact(contact_id, contact)) }]
  })
);

server.tool(
  "kvcore_contact_tag_add",
  "Add one or more tags to a contact.",
  {
    contact_id: z.number().int().positive(),
    tags: z.array(z.string().min(1)).min(1)
  },
  async ({ contact_id, tags }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.addTags(contact_id, tags)) }]
  })
);

server.tool(
  "kvcore_contact_tag_remove",
  "Remove one or more tags from a contact.",
  {
    contact_id: z.number().int().positive(),
    tags: z.array(z.string().min(1)).min(1)
  },
  async ({ contact_id, tags }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.removeTags(contact_id, tags)) }]
  })
);

server.tool(
  "kvcore_note_add",
  "Add a note to a contact.",
  {
    contact_id: z.number().int().positive(),
    note: z.string().min(1)
  },
  async ({ contact_id, note }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.addNote(contact_id, note)) }]
  })
);

server.tool(
  "kvcore_call_log",
  "Log a call action to a contact using KVcore call payload fields.",
  {
    contact_id: z.number().int().positive(),
    call: z.record(z.string(), z.any())
  },
  async ({ contact_id, call }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.logCall(contact_id, call)) }]
  })
);

server.tool(
  "kvcore_call_schedule",
  "Schedule a call via KVcore schedule-call endpoint.",
  {
    schedule: z.record(z.string(), z.any())
  },
  async ({ schedule }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.scheduleCall(schedule)) }]
  })
);

server.tool(
  "kvcore_email_send",
  "Send email via KVcore contact email endpoint.",
  {
    contact_id: z.number().int().positive(),
    subject: z.string().min(1),
    message: z.string().min(1)
  },
  async ({ contact_id, subject, message }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.sendEmail(contact_id, subject, message)) }]
  })
);

server.tool(
  "kvcore_text_send",
  "Send SMS/text via KVcore contact text endpoint.",
  {
    contact_id: z.number().int().positive(),
    message: z.string().min(1)
  },
  async ({ contact_id, message }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.sendText(contact_id, message)) }]
  })
);

server.tool(
  "kvcore_user_tasks",
  "List tasks for a KVcore user.",
  {
    user_id: z.number().int().positive()
  },
  async ({ user_id }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.getUserTasks(user_id)) }]
  })
);

server.tool(
  "kvcore_user_calls",
  "List calls for a KVcore user.",
  {
    user_id: z.number().int().positive()
  },
  async ({ user_id }) => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.getUserCalls(user_id)) }]
  })
);

server.tool(
  "kvcore_campaigns_refresh",
  "Refresh campaign data (superaccount endpoint).",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await kvcore.refreshCampaigns()) }]
  })
);

server.tool(
  "twilio_call_create",
  "Create an outbound phone call in Twilio (optional fallback when KVcore calling is insufficient).",
  {
    to: z.string().min(5),
    twiml_url: z.string().url().optional(),
    twiml: z.string().min(1).optional()
  },
  async ({ to, twiml_url, twiml }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !from) {
      throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required");
    }

    const call = await createTwilioCall(
      { accountSid, authToken, from },
      { to, twimlUrl: twiml_url, twiml }
    );

    return {
      content: [{ type: "text", text: JSON.stringify(call) }]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
