#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { NewtonSupplierService } from "./service.js";
import { SupplierFields } from "./types.js";

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseFields(input: string[]): SupplierFields {
  const out: SupplierFields = {};
  for (const item of input) {
    const idx = item.indexOf("=");
    if (idx <= 0) {
      throw new Error(`Invalid --field value: ${item}. Expected key=value`);
    }
    const key = item.slice(0, idx).trim();
    const rawValue = item.slice(idx + 1).trim();
    out[key] = coerceValue(rawValue);
  }
  return out;
}

function coerceValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;

  const asNumber = Number(value);
  if (value.length > 0 && Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(value)) {
    return asNumber;
  }

  return value;
}

async function main() {
  const service = new NewtonSupplierService(loadConfig());
  const cli = new Command();

  cli
    .name("newton-supplier")
    .description("Newton Supplier API (SOAP) CLI");

  cli
    .command("call")
    .requiredOption("--operation <name>", "SOAP operation name")
    .option("--field <key=value>", "request field", (val, memo) => {
      memo.push(val);
      return memo;
    }, [] as string[])
    .option("--soap-action <value>")
    .option("--raw-body-file <path>", "XML body file (skips --field map)")
    .action(
      async (opts: {
        operation: string;
        field: string[];
        soapAction?: string;
        rawBodyFile?: string;
      }) => {
        const rawBodyXml = opts.rawBodyFile
          ? await import("node:fs/promises").then((fs) => fs.readFile(opts.rawBodyFile!, "utf8"))
          : undefined;
        const fields = rawBodyXml ? undefined : parseFields(opts.field);

        const result = await service.callOperation({
          operation: opts.operation,
          fields,
          rawBodyXml,
          soapAction: opts.soapAction
        });
        print(result);
      }
    );

  cli
    .command("get")
    .description("Invoke configured Get operation")
    .option("--field <key=value>", "request field", (val, memo) => {
      memo.push(val);
      return memo;
    }, [] as string[])
    .action(async (opts: { field: string[] }) => {
      print(await service.getReferrals(parseFields(opts.field)));
    });

  cli
    .command("ack")
    .description("Invoke configured Ack operation")
    .option("--field <key=value>", "request field", (val, memo) => {
      memo.push(val);
      return memo;
    }, [] as string[])
    .action(async (opts: { field: string[] }) => {
      print(await service.acknowledgeReferral(parseFields(opts.field)));
    });

  await cli.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
