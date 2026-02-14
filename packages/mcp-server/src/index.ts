import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { actionInputSchema } from "@fub/core";
import { createEngine, makeRequest } from "./runtime.js";

const { engine } = createEngine();

const server = new McpServer({
  name: "fub-mcp-server",
  version: "0.1.0"
});

server.tool(
  "fub_action",
  "Execute one validated FUB action. Defaults to dry_run=true and confirm=false.",
  {
    input: actionInputSchema,
    dry_run: z.boolean().default(true),
    confirm: z.boolean().default(false),
    verbose: z.boolean().default(false),
    role: z.enum(["operator", "assistant", "automation", "readonly"]).default("assistant")
  },
  async ({ input, dry_run, confirm, verbose, role }) => {
    const result = await engine.run(
      makeRequest(input, {
        dryRun: dry_run,
        confirm,
        verbose,
        role
      })
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ]
    };
  }
);

server.tool(
  "workflow_text_and_task",
  "Workflow: text a contact and create a task for follow-up time.",
  {
    personQuery: z.string().min(1),
    message: z.string().min(1),
    dueAt: z.string().min(1),
    dry_run: z.boolean().default(true),
    confirm: z.boolean().default(false)
  },
  async ({ personQuery, message, dueAt, dry_run, confirm }) => {
    const find = await engine.run(
      makeRequest({ action: "person.find", query: personQuery }, { dryRun: false, confirm: true, verbose: true })
    );

    const person = Array.isArray(find.data) ? find.data[0] : undefined;
    if (!person || typeof person !== "object") {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "person not found" }) }] };
    }

    const personRef = { personId: Number((person as { id: number }).id) };

    const sms = await engine.run(makeRequest({
      action: "message.send",
      channel: "sms",
      to: personQuery.startsWith("+") ? personQuery : "+14165550001",
      body: message,
      person: personRef,
      logToFub: true
    }, { dryRun: dry_run, confirm, verbose: true }));

    const task = await engine.run(makeRequest({
      action: "task.create",
      person: personRef,
      title: `Call follow-up: ${personQuery}`,
      dueAt
    }, { dryRun: dry_run, confirm, verbose: true }));

    return {
      content: [{ type: "text", text: JSON.stringify({ person: find.data, sms, task }) }]
    };
  }
);

server.tool(
  "workflow_listing_status",
  "Workflow: get listing status by address and optionally include CRM context.",
  {
    address: z.string().min(1),
    includeCrmContext: z.boolean().default(false)
  },
  async ({ address, includeCrmContext }) => {
    const listing = await engine.run(makeRequest({ action: "listing.get", address }, { dryRun: false, confirm: true, verbose: true }));

    let crm: unknown = null;
    if (includeCrmContext) {
      crm = await engine.run(makeRequest({ action: "person.find", query: address }, { dryRun: false, confirm: true, verbose: true }));
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: listing.data,
            crm
          })
        }
      ]
    };
  }
);

server.tool(
  "workflow_hotlead_task",
  "Workflow: add tag HotLead and create follow-up task in 2 days.",
  {
    personQuery: z.string().min(1),
    tag: z.string().default("HotLead"),
    dueAt: z.string().optional(),
    dry_run: z.boolean().default(true),
    confirm: z.boolean().default(false)
  },
  async ({ personQuery, tag, dueAt, dry_run, confirm }) => {
    const find = await engine.run(makeRequest({ action: "person.find", query: personQuery }, { dryRun: false, confirm: true, verbose: true }));
    const person = Array.isArray(find.data) ? find.data[0] : undefined;
    const personRef = person && typeof person === "object" ? { personId: Number((person as { id: number }).id) } : { name: personQuery };

    const tagResult = await engine.run(makeRequest({ action: "person.tag.add", person: personRef, tag }, { dryRun: dry_run, confirm, verbose: true }));
    const taskResult = await engine.run(makeRequest({
      action: "task.create",
      person: personRef,
      title: `Follow up with ${personQuery}`,
      dueAt: dueAt ?? new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString()
    }, { dryRun: dry_run, confirm, verbose: true }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ tagResult, taskResult })
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
