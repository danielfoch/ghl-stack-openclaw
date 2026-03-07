#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { DdfService } from "./service.js";

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

async function main() {
  let service: DdfService | undefined;
  const getService = () => {
    if (!service) {
      service = new DdfService(loadConfig());
    }
    return service;
  };
  const cli = new Command();

  cli.name("crea-ddf").description("CREA DDF CLI (plus MCP server via crea-ddf-mcp)");

  cli
    .command("search-properties")
    .description("Search Property records with structured filters")
    .option("--filters-json <json>", "JSON object of filters")
    .option("--top <n>", "page size", (v) => Number(v))
    .option("--skip <n>", "offset", (v) => Number(v))
    .option("--select <csv>", "comma-separated fields")
    .option("--order-by <value>", "example: ListPrice desc")
    .option("--no-count", "disable @odata.count")
    .action(async (opts: { filtersJson?: string; top?: number; skip?: number; select?: string; orderBy?: string; count?: boolean }) => {
      const filters = opts.filtersJson
        ? (parseJsonObject(opts.filtersJson, "--filters-json") as {
            city?: string;
            province?: string;
            postalCode?: string;
            minPrice?: number;
            maxPrice?: number;
            minBeds?: number;
            minBaths?: number;
            status?: string;
            updatedSince?: string;
          })
        : undefined;

      const select = opts.select?.split(",").map((s) => s.trim()).filter(Boolean);

      print(
        await getService().searchProperties({
          filters,
          top: opts.top,
          skip: opts.skip,
          select,
          orderBy: opts.orderBy,
          includeCount: opts.count
        })
      );
    });

  cli
    .command("get-property")
    .description("Get one property by ListingKey")
    .requiredOption("--id <listingKey>", "listing key")
    .option("--summary", "summary fields only")
    .option("--select <csv>", "comma-separated fields")
    .action(async (opts: { id: string; summary?: boolean; select?: string }) => {
      const select = opts.select?.split(",").map((s) => s.trim()).filter(Boolean);
      print(
        await getService().getProperty({
          id: opts.id,
          detail: !opts.summary,
          select
        })
      );
    });

  cli
    .command("get-property-media")
    .description("Get media for a listing key")
    .requiredOption("--id <listingKey>", "listing key")
    .option("--top <n>", "page size", (v) => Number(v))
    .option("--skip <n>", "offset", (v) => Number(v))
    .option("--select <csv>", "comma-separated fields")
    .action(async (opts: { id: string; top?: number; skip?: number; select?: string }) => {
      const select = opts.select?.split(",").map((s) => s.trim()).filter(Boolean);
      print(
        await getService().getPropertyMedia({
          id: opts.id,
          top: opts.top,
          skip: opts.skip,
          select
        })
      );
    });

  cli.command("get-metadata").description("Fetch OData metadata").action(async () => {
    print(await getService().getMetadata());
  });

  cli
    .command("raw-request")
    .description("Raw DDF request (advanced)")
    .requiredOption("--method <GET|POST>", "HTTP method")
    .requiredOption("--path <value>", "path, e.g. /Property")
    .option("--query-json <json>", "JSON object of query params")
    .option("--body-json <json>", "JSON body for POST")
    .option("--no-auth", "disable bearer auth")
    .action(
      async (opts: { method: "GET" | "POST"; path: string; queryJson?: string; bodyJson?: string; auth?: boolean }) => {
        const query = opts.queryJson
          ? (parseJsonObject(opts.queryJson, "--query-json") as Record<
              string,
              string | number | boolean | null | undefined
            >)
          : undefined;
        const body = opts.bodyJson ? parseJsonObject(opts.bodyJson, "--body-json") : undefined;

        print(
          await getService().rawRequest({
            method: opts.method,
            path: opts.path,
            query,
            body,
            auth: opts.auth
          })
        );
      }
    );

  await cli.parseAsync(process.argv);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
