#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { z } from "zod";
import { JsonObject, NewtonLinkApiError } from "./client.js";
import { loadConfig } from "./config.js";
import { NewtonLinkService } from "./service.js";

const payloadOptionSchema = z.object({
  json: z.string().optional(),
  jsonFile: z.string().optional()
});

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseJsonObject(raw: string): JsonObject {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object");
  }
  return parsed as JsonObject;
}

async function parsePayload(opts: { json?: string; jsonFile?: string }): Promise<JsonObject> {
  const parsed = payloadOptionSchema.parse(opts);
  if (parsed.json && parsed.jsonFile) {
    throw new Error("Provide either --json or --json-file, not both");
  }

  if (parsed.json) {
    return parseJsonObject(parsed.json);
  }

  if (parsed.jsonFile) {
    const fileContents = await readFile(parsed.jsonFile, "utf8");
    return parseJsonObject(fileContents);
  }

  throw new Error("Payload is required: pass --json or --json-file");
}

function addPayloadOptions(command: Command): Command {
  return command
    .option("--json <value>", "inline JSON payload (object)")
    .option("--json-file <path>", "path to a JSON payload file");
}

async function main() {
  let service: NewtonLinkService | undefined;
  const getService = () => {
    if (!service) {
      service = new NewtonLinkService(loadConfig());
    }
    return service;
  };
  const cli = new Command();

  cli
    .name("newton-link")
    .description("Newton Link lender-side API CLI")
    .showHelpAfterError();

  cli.command("auth-token").description("Fetch token metadata").option("--refresh").action(async (opts: { refresh?: boolean }) => {
    print(await getService().authInfo(Boolean(opts.refresh)));
  });

  cli
    .command("lender-details")
    .description("Get lenders and lender products")
    .option("--unit-id <id>")
    .option("--pos-system-id <id>")
    .action(async (opts: { unitId?: string; posSystemId?: string }) => {
      print(await getService().lenderDetails(opts));
    });

  addPayloadOptions(cli.command("submit-application").description("POST /v1/applications")).action(
    async (opts: { json?: string; jsonFile?: string }) => {
      print(await getService().submitApplication(await parsePayload(opts)));
    }
  );

  addPayloadOptions(
    cli.command("validate-application").description("POST /v1/validations/applications")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().validateApplication(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli.command("submit-document").description("POST /v1/application/documents")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().submitDocument(await parsePayload(opts)));
  });

  cli
    .command("pending-applications")
    .description("GET /v1/pending-applications")
    .option("--unit-id <id>")
    .option("--pos-system-id <id>")
    .action(async (opts: { unitId?: string; posSystemId?: string }) => {
      print(await getService().pendingApplications(opts));
    });

  addPayloadOptions(
    cli.command("search-application-decisions").description("POST /v1/application-decisions/search")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().searchApplicationDecisions(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli
      .command("acknowledge-application-decision")
      .description("POST /v1/application-decisions/acknowledgement")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().acknowledgeApplicationDecision(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli.command("update-application-status").description("POST /v1/application/updatestatus")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().updateApplicationStatus(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli
      .command("update-compliance-status")
      .description("POST /v1/application/updatecompliancestatus")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().updateComplianceStatus(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli.command("credit-bureau-equifax").description("POST /v1/credit-bureau/equifax")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().creditBureauEquifax(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli.command("credit-bureau-transunion").description("POST /v1/credit-bureau/transunion")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().creditBureauTransunion(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli.command("submit-life-insurance").description("POST /v1/life-insurance")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().submitLifeInsurance(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli.command("life-insurance-status").description("POST /v1/life-insurance-status")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().lifeInsuranceStatus(await parsePayload(opts)));
  });

  addPayloadOptions(
    cli
      .command("acknowledge-life-insurance-status")
      .description("POST /v1/life-insurance-status/acknowledgement")
  ).action(async (opts: { json?: string; jsonFile?: string }) => {
    print(await getService().acknowledgeLifeInsuranceStatus(await parsePayload(opts)));
  });

  addPayloadOptions(cli.command("property-valuation").description("POST /v1/valuations")).action(
    async (opts: { json?: string; jsonFile?: string }) => {
      print(await getService().propertyValuation(await parsePayload(opts)));
    }
  );

  await cli.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  if (error instanceof NewtonLinkApiError) {
    process.stderr.write(
      `${error.message}\nHTTP ${error.status} ${error.statusText}\n${JSON.stringify(error.body, null, 2)}\n`
    );
    process.exitCode = 1;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
