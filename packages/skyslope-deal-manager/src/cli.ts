#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { DealManagerService } from "./service.js";
import type { DealType } from "./types.js";
import { OpenAiPdfSplitter } from "./plugins/openai-pdf-split.js";
import { GeminiNanoPdfAuthoring } from "./plugins/gemini-nano-pdf.js";

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const cfg = loadConfig();
  const svc = new DealManagerService(cfg);
  const cli = new Command();

  cli.name("skyslope-deal").description("SkySlope transaction and paperwork manager");

  cli
    .command("sync-transaction")
    .requiredOption("--transaction-id <id>")
    .action(async (opts: { transactionId: string }) => {
      const result = await svc.syncTransaction(opts.transactionId);
      print(result);
    });

  cli
    .command("ingest-text")
    .requiredOption("--deal-id <id>")
    .requiredOption("--file <path>")
    .option("--category <category>", "document category", "uncategorized")
    .action(async (opts: { dealId: string; file: string; category: string }) => {
      const result = await svc.ingestTextFile({
        dealId: opts.dealId,
        filePath: opts.file,
        category: opts.category
      });
      print(result);
    });

  cli
    .command("ingest-pdf")
    .requiredOption("--deal-id <id>")
    .requiredOption("--file <path>")
    .option("--category <category>", "document category", "pdf")
    .action(async (opts: { dealId: string; file: string; category: string }) => {
      const result = await svc.ingestPdfFile({
        dealId: opts.dealId,
        filePath: opts.file,
        category: opts.category
      });
      print(result);
    });

  cli
    .command("validate-name")
    .requiredOption("--name <value>")
    .action((opts: { name: string }) => {
      print(svc.validateNaming(opts.name));
    });

  cli
    .command("suggest-name")
    .requiredOption("--address <value>")
    .requiredOption("--type <dealType>")
    .action((opts: { address: string; type: DealType }) => {
      print({ suggested: svc.suggestNaming(opts.address, opts.type) });
    });

  cli
    .command("deal")
    .requiredOption("--id <value>")
    .action((opts: { id: string }) => {
      print({
        deal: svc.getDeal(opts.id),
        documents: svc.listDocumentsForDeal(opts.id)
      });
    });

  cli
    .command("search")
    .requiredOption("--query <value>")
    .action((opts: { query: string }) => {
      print(svc.queryDeals(opts.query));
    });

  cli
    .command("plugin:split-pdf")
    .requiredOption("--input <path>")
    .option(
      "--ranges <value>",
      "JSON ranges, example: [{\"start\":1,\"end\":3}]",
      ""
    )
    .action(async (opts: { input: string; ranges: string }) => {
      const plugin = new OpenAiPdfSplitter(cfg.OPENAI_API_KEY, cfg.OPENAI_MODEL);
      const ranges = opts.ranges
        ? (JSON.parse(opts.ranges) as Array<{ start: number; end: number }>)
        : await plugin.suggestRanges(opts.input);
      const outputs = await plugin.splitPdf(opts.input, ranges);
      print({ ranges, outputs });
    });

  cli
    .command("plugin:author-doc")
    .requiredOption("--title <value>")
    .requiredOption("--instructions <value>")
    .option("--context <value>")
    .action(
      async (opts: { title: string; instructions: string; context?: string }) => {
        const plugin = new GeminiNanoPdfAuthoring(
          cfg.GEMINI_API_KEY,
          cfg.GEMINI_MODEL
        );
        const result = await plugin.authorDocument(opts);
        print(result);
      }
    );

  await cli.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
