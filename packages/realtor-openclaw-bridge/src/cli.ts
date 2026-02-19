#!/usr/bin/env node
import { Command } from "commander";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { RealtorBridgeService } from "./service.js";
import { BridgeProviderName, BridgeResource } from "./types.js";

const providerSchema = z.enum(["nexone", "faltour", "lonewolf"]);
const resourceSchema = z.enum([
  "offers",
  "folders",
  "documents",
  "listings",
  "contacts",
  "custom"
]);

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseProvider(value: string): BridgeProviderName {
  return providerSchema.parse(value);
}

function parseResource(value: string): BridgeResource {
  return resourceSchema.parse(value);
}

function parseJson(value: string): Record<string, unknown> {
  return z.record(z.unknown()).parse(JSON.parse(value));
}

function parsePositiveIntegerOption(optionName: string, value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  return parsed;
}

async function main() {
  const service = new RealtorBridgeService(loadConfig());
  const cli = new Command();

  cli
    .name("openclaw-bridge")
    .description("Bridge OpenClaw Realtor events with NexOne, Faltour, and Lone Wolf");

  cli
    .command("health")
    .requiredOption("--provider <name>", "nexone|faltour|lonewolf")
    .action(async (opts: { provider: string }) => {
      print(await service.health(parseProvider(opts.provider)));
    });

  cli
    .command("pull")
    .requiredOption("--provider <name>", "nexone|faltour|lonewolf")
    .requiredOption("--resource <name>", "offers|folders|documents|listings|contacts|custom")
    .option("--user-id <id>")
    .option("--filter <expr>")
    .option("--cursor <value>")
    .option("--cursor-key <value>")
    .option("--limit <value>")
    .action(
      async (opts: {
        provider: string;
        resource: string;
        userId?: string;
        filter?: string;
        cursor?: string;
        cursorKey?: string;
        limit?: string;
      }) => {
        print(
          await service.pull(
            parseProvider(opts.provider),
            {
              resource: parseResource(opts.resource),
              userId: opts.userId,
              filter: opts.filter,
              cursor: opts.cursor,
              limit: parsePositiveIntegerOption("--limit", opts.limit)
            },
            opts.cursorKey
          )
        );
      }
    );

  cli
    .command("push")
    .requiredOption("--provider <name>", "nexone|faltour|lonewolf")
    .requiredOption("--entity-type <value>", "contact|listing|offer|transaction|document|custom")
    .requiredOption("--payload-json <value>", "JSON payload from OpenClaw")
    .option("--event-id <value>")
    .action(
      async (opts: {
        provider: string;
        entityType: string;
        payloadJson: string;
        eventId?: string;
      }) => {
        print(
          await service.push(parseProvider(opts.provider), {
            id: opts.eventId,
            entityType: opts.entityType as any,
            payload: parseJson(opts.payloadJson)
          })
        );
      }
    );

  cli
    .command("fanout")
    .requiredOption("--providers <csv>", "comma-separated providers")
    .requiredOption("--entity-type <value>", "contact|listing|offer|transaction|document|custom")
    .requiredOption("--payload-json <value>", "JSON payload from OpenClaw")
    .option("--event-id <value>")
    .action(
      async (opts: {
        providers: string;
        entityType: string;
        payloadJson: string;
        eventId?: string;
      }) => {
        const providers = opts.providers
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .map(parseProvider);
        print(
          await service.fanout(providers, {
            id: opts.eventId,
            entityType: opts.entityType as any,
            payload: parseJson(opts.payloadJson)
          })
        );
      }
    );

  cli
    .command("events")
    .option("--limit <n>", "event rows to return", "25")
    .action((opts: { limit: string }) => {
      print(service.recentEvents(parsePositiveIntegerOption("--limit", opts.limit)));
    });

  await cli.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
