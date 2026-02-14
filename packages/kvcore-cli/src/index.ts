#!/usr/bin/env node
import fs from "node:fs";
import { Command } from "commander";
import { KvCoreAdapter, createTwilioCall, loadKvCoreConfig } from "@fub/adapters-kvcore";

const root = new Command();
root
  .name("kvcore")
  .description("KVcore CLI for CRM operations")
  .option("--pretty", "Pretty-print JSON output", false);

let kvcoreClient: KvCoreAdapter | undefined;

const contact = root.command("contact");

contact
  .command("search")
  .option("--query <query>")
  .option("--page <page>")
  .option("--per-page <perPage>")
  .action(async (opts) => {
    const out = await getKvcore().searchContacts(opts.query, numberOrUndefined(opts.page), numberOrUndefined(opts.perPage));
    print(out);
  });

contact
  .command("get")
  .requiredOption("--id <contactId>")
  .action(async (opts) => {
    print(await getKvcore().getContact(Number(opts.id)));
  });

contact
  .command("create")
  .requiredOption("--json <jsonOrPath>")
  .action(async (opts) => {
    print(await getKvcore().createContact(loadJsonInput(opts.json)));
  });

contact
  .command("update")
  .requiredOption("--id <contactId>")
  .requiredOption("--json <jsonOrPath>")
  .action(async (opts) => {
    print(await getKvcore().updateContact(Number(opts.id), loadJsonInput(opts.json)));
  });

contact
  .command("tags:add")
  .requiredOption("--id <contactId>")
  .requiredOption("--tags <tagsCsv>")
  .action(async (opts) => {
    print(await getKvcore().addTags(Number(opts.id), csv(opts.tags)));
  });

contact
  .command("tags:remove")
  .requiredOption("--id <contactId>")
  .requiredOption("--tags <tagsCsv>")
  .action(async (opts) => {
    print(await getKvcore().removeTags(Number(opts.id), csv(opts.tags)));
  });

root
  .command("note:add")
  .requiredOption("--contact-id <contactId>")
  .requiredOption("--text <text>")
  .action(async (opts) => {
    print(await getKvcore().addNote(Number(opts.contactId), opts.text));
  });

root
  .command("call:log")
  .requiredOption("--contact-id <contactId>")
  .requiredOption("--json <jsonOrPath>")
  .action(async (opts) => {
    print(await getKvcore().logCall(Number(opts.contactId), loadJsonInput(opts.json)));
  });

root
  .command("call:schedule")
  .requiredOption("--json <jsonOrPath>")
  .action(async (opts) => {
    print(await getKvcore().scheduleCall(loadJsonInput(opts.json)));
  });

root
  .command("call:twilio")
  .requiredOption("--to <phone>")
  .option("--twiml-url <url>")
  .option("--twiml <xml>")
  .action(async (opts) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !from) {
      throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required");
    }

    print(await createTwilioCall(
      { accountSid, authToken, from },
      { to: opts.to, twimlUrl: opts.twimlUrl, twiml: opts.twiml }
    ));
  });

root
  .command("email:send")
  .requiredOption("--contact-id <contactId>")
  .requiredOption("--subject <subject>")
  .requiredOption("--body <body>")
  .action(async (opts) => {
    print(await getKvcore().sendEmail(Number(opts.contactId), opts.subject, opts.body));
  });

root
  .command("text:send")
  .requiredOption("--contact-id <contactId>")
  .requiredOption("--body <body>")
  .action(async (opts) => {
    print(await getKvcore().sendText(Number(opts.contactId), opts.body));
  });

const user = root.command("user");

user
  .command("tasks")
  .requiredOption("--user-id <userId>")
  .action(async (opts) => {
    print(await getKvcore().getUserTasks(Number(opts.userId)));
  });

user
  .command("calls")
  .requiredOption("--user-id <userId>")
  .action(async (opts) => {
    print(await getKvcore().getUserCalls(Number(opts.userId)));
  });

root
  .command("campaigns:refresh")
  .action(async () => {
    print(await getKvcore().refreshCampaigns());
  });

root
  .command("raw")
  .requiredOption("--method <method>")
  .requiredOption("--path <path>")
  .option("--query <queryJsonOrPath>")
  .option("--json <jsonOrPath>")
  .action(async (opts) => {
    const method = String(opts.method).toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    const query = opts.query ? (loadJsonInput(opts.query) as Record<string, string | number | boolean>) : undefined;
    const body = opts.json ? loadJsonInput(opts.json) : undefined;
    print(await getKvcore().raw({ method, path: opts.path, query, body }));
  });

root.parseAsync(process.argv).catch((error) => {
  print({ ok: false, error: (error as Error).message });
  process.exitCode = 1;
});

function print(payload: unknown): void {
  if (root.opts<{ pretty: boolean }>().pretty) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload));
  }
}

function loadJsonInput(value: string): Record<string, unknown> {
  if (fs.existsSync(value)) {
    return JSON.parse(fs.readFileSync(value, "utf8")) as Record<string, unknown>;
  }
  return JSON.parse(value) as Record<string, unknown>;
}

function numberOrUndefined(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

function csv(value: string): string[] {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function getKvcore(): KvCoreAdapter {
  if (!kvcoreClient) {
    kvcoreClient = new KvCoreAdapter(loadKvCoreConfig(process.env));
  }
  return kvcoreClient;
}
