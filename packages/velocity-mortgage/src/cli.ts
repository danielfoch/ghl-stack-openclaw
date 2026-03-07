#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { VelocityService } from "./service.js";
import { VelocityGetDealsQuery } from "./types.js";

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function readJsonInput(opts: {
  bodyJson?: string;
  bodyFile?: string;
}): Promise<Record<string, unknown>> {
  const provided = [Boolean(opts.bodyJson), Boolean(opts.bodyFile)].filter(Boolean).length;
  if (provided !== 1) {
    throw new Error("Provide exactly one of --body-json or --body-file");
  }

  if (opts.bodyJson) {
    return parseJsonObject(opts.bodyJson, "--body-json");
  }

  const raw = await readFile(opts.bodyFile as string, "utf8");
  return parseJsonObject(raw, "--body-file");
}

function parseJsonObject(input: string, source: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${source} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid JSON in ${source}: ${error.message}`);
    }
    throw error;
  }
}

function parseInteger(optionName: string, value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${optionName} must be an integer`);
  }
  return parsed;
}

async function main() {
  let service: VelocityService | undefined;
  const getService = () => {
    if (!service) {
      service = new VelocityService();
    }
    return service;
  };
  const cli = new Command();

  cli
    .name("velocity-mortgage")
    .description("CLI for Newton Velocity Mortgage API (v1)");

  cli
    .command("contact-create")
    .description("POST /v1/contacts/contact")
    .option("--body-json <json>", "inline JSON object")
    .option("--body-file <path>", "path to JSON file")
    .action(async (opts: { bodyJson?: string; bodyFile?: string }) => {
      print(await getService().createContact(await readJsonInput(opts)));
    });

  cli
    .command("contact-sample")
    .description("GET /v1/contacts/contact/sample")
    .action(async () => {
      print(await getService().getSampleContact());
    });

  cli
    .command("deal-create")
    .description("POST /v1/deals/deal")
    .option("--body-json <json>", "inline JSON object")
    .option("--body-file <path>", "path to JSON file")
    .action(async (opts: { bodyJson?: string; bodyFile?: string }) => {
      print(await getService().createDeal(await readJsonInput(opts)));
    });

  cli
    .command("deal-sample")
    .description("GET /v1/deals/deal/sample")
    .action(async () => {
      print(await getService().getSampleDeal());
    });

  cli
    .command("deals")
    .description("GET /v1/deals")
    .option("--deal-status <value>", "dealstatus query parameter")
    .option("--custom-source <value>", "customsource query parameter")
    .option("--date-type <value>", "datetype query parameter")
    .option("--start-date <iso>", "startdate query parameter")
    .option("--end-date <iso>", "enddate query parameter")
    .option("--loan-code <value>", "loancode query parameter")
    .option("--page <value>", "page query parameter")
    .action(
      async (opts: {
        dealStatus?: string;
        customSource?: string;
        dateType?: string;
        startDate?: string;
        endDate?: string;
        loanCode?: string;
        page?: string;
      }) => {
        const query: VelocityGetDealsQuery = {
          dealstatus: opts.dealStatus,
          customsource: opts.customSource,
          datetype: parseInteger("--date-type", opts.dateType),
          startdate: opts.startDate,
          enddate: opts.endDate,
          loancode: opts.loanCode,
          page: parseInteger("--page", opts.page)
        };
        print(await getService().getDeals(query));
      }
    );

  cli
    .command("deals-search")
    .description("POST /v1/deals/search")
    .option("--body-json <json>", "inline JSON object")
    .option("--body-file <path>", "path to JSON file")
    .action(async (opts: { bodyJson?: string; bodyFile?: string }) => {
      print(await getService().searchDeals(await readJsonInput(opts)));
    });

  cli
    .command("request")
    .description("Raw request for unmodeled Velocity endpoints")
    .requiredOption("--method <value>", "GET|POST|PUT|PATCH|DELETE")
    .requiredOption("--path <value>", "example: /v1/deals")
    .option("--query-json <json>", "JSON object of query params")
    .option("--body-json <json>", "JSON body object")
    .action(
      async (opts: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        path: string;
        queryJson?: string;
        bodyJson?: string;
      }) => {
        const query = opts.queryJson
          ? (parseJsonObject(opts.queryJson, "--query-json") as Record<
              string,
              string | number | boolean | null | undefined
            >)
          : undefined;
        const body = opts.bodyJson ? parseJsonObject(opts.bodyJson, "--body-json") : undefined;

        print(await getService().request(opts.method, opts.path, query, body));
      }
    );

  await cli.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
