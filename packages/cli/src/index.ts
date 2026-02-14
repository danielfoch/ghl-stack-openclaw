#!/usr/bin/env node
import fs from "node:fs";
import { Command } from "commander";
import { extractCommand, type ActionRequest } from "@fub/core";
import { createEngine, makeRequest } from "./runtime.js";

const program = new Command();
const { engine } = createEngine();

program
  .name("fub")
  .description("Follow Up Boss screenless CLI")
  .option("--pretty", "pretty JSON output", false)
  .option("--trace", "include correlation ids", false);

program
  .command("who")
  .argument("<query>")
  .action(async (query: string) => run({
    permissionScope: "person:read",
    role: "assistant",
    dryRun: false,
    confirm: true,
    verbose: true,
    input: { action: "person.find", query }
  }));

program
  .command("note")
  .requiredOption("--person <person>")
  .requiredOption("--text <text>")
  .option("--confirm", "execute", false)
  .action(async (opts) => run({
    permissionScope: "person:write",
    role: "assistant",
    dryRun: !opts.confirm,
    confirm: Boolean(opts.confirm),
    verbose: true,
    input: {
      action: "note.create",
      person: personRef(opts.person),
      text: opts.text
    }
  }));

program
  .command("task")
  .command("create")
  .requiredOption("--person <person>")
  .requiredOption("--title <title>")
  .option("--due <due>")
  .option("--confirm", "execute", false)
  .action(async (opts) => run({
    permissionScope: "task:write",
    role: "assistant",
    dryRun: !opts.confirm,
    confirm: Boolean(opts.confirm),
    verbose: true,
    input: {
      action: "task.create",
      person: personRef(opts.person),
      title: opts.title,
      dueAt: opts.due
    }
  }));

program
  .command("sms")
  .command("send")
  .requiredOption("--to <to>")
  .requiredOption("--body <body>")
  .option("--person <person>")
  .option("--confirm", "execute", false)
  .action(async (opts) => run({
    permissionScope: "message:send",
    role: "assistant",
    dryRun: !opts.confirm,
    confirm: Boolean(opts.confirm),
    verbose: true,
    input: {
      action: "message.send",
      channel: "sms",
      to: opts.to,
      body: opts.body,
      person: opts.person ? personRef(opts.person) : undefined,
      logToFub: true
    }
  }));

program
  .command("idx")
  .command("search")
  .option("--city <city>")
  .option("--minBeds <minBeds>")
  .option("--maxPrice <maxPrice>")
  .action(async (opts) => {
    const query: Record<string, string | number | boolean> = {};
    if (opts.city) query.city = opts.city;
    if (opts.minBeds) query.minBeds = Number(opts.minBeds);
    if (opts.maxPrice) query.maxPrice = Number(opts.maxPrice);

    await run({
      permissionScope: "listing:read",
      role: "assistant",
      dryRun: false,
      confirm: true,
      verbose: true,
      input: { action: "listing.search", query }
    });
  });

program
  .command("plan")
  .requiredOption("--from-message <path>")
  .option("--dry-run", "dry run", false)
  .action(async (opts) => {
    const text = fs.readFileSync(opts.fromMessage, "utf8");
    const cmd = extractCommand(text);
    const req: ActionRequest = makeRequest({
      permissionScope: "instruction:execute",
      role: "assistant",
      dryRun: Boolean(opts.dryRun),
      confirm: !opts.dryRun,
      verbose: true,
      input: {
        action: cmd.action as never,
        ...(cmd.input as object)
      } as never,
      idempotencyKey: cmd.idempotencyKey
    });
    const result = await engine.run(req);
    print(result);
  });

program.parseAsync(process.argv).catch((error) => {
  print({ ok: false, error: (error as Error).message });
  process.exitCode = 1;
});

async function run(request: Omit<ActionRequest, "audit" | "idempotencyKey"> & { idempotencyKey?: string }) {
  const result = await engine.run(makeRequest(request));
  print(result);
}

function personRef(value: string): { personId?: number; email?: string; phone?: string; name?: string } {
  if (value.startsWith("+")) return { phone: value };
  if (value.includes("@")) return { email: value };
  if (/^\d+$/.test(value)) return { personId: Number(value) };
  return { name: value };
}

function print(payload: unknown): void {
  const root = program.opts<{ pretty: boolean }>();
  if (root.pretty) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload));
  }
}
