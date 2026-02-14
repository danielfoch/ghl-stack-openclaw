import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import type { PdfSplitterPlugin } from "./interfaces.js";

export class OpenAiPdfSplitter implements PdfSplitterPlugin {
  constructor(
    private readonly apiKey?: string,
    private readonly model = "gpt-4.1-mini"
  ) {}

  async suggestRanges(filename: string): Promise<Array<{ start: number; end: number }>> {
    if (!this.apiKey) {
      return [{ start: 1, end: 9999 }];
    }

    const prompt = `Return JSON only: {"ranges":[{"start":1,"end":2}]}. File name: ${filename}. Suggest likely split ranges by document sections.`;
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt
      })
    });

    if (!res.ok) {
      return [{ start: 1, end: 9999 }];
    }

    const json = (await res.json()) as {
      output_text?: string;
    };

    try {
      const parsed = JSON.parse(json.output_text ?? "") as {
        ranges?: Array<{ start: number; end: number }>;
      };
      if (!parsed.ranges?.length) {
        return [{ start: 1, end: 9999 }];
      }
      return parsed.ranges;
    } catch {
      return [{ start: 1, end: 9999 }];
    }
  }

  async splitPdf(
    inputPath: string,
    pageRanges: Array<{ start: number; end: number }>
  ): Promise<string[]> {
    const bytes = await fs.readFile(inputPath);
    const source = await PDFDocument.load(bytes);
    const totalPages = source.getPageCount();
    const outputPaths: string[] = [];

    for (let i = 0; i < pageRanges.length; i += 1) {
      const range = pageRanges[i];
      if (!range) {
        continue;
      }
      const start = Math.max(1, range.start);
      const end = Math.min(totalPages, range.end);
      if (start > end) {
        continue;
      }

      const target = await PDFDocument.create();
      const pageIndexes = Array.from(
        { length: end - start + 1 },
        (_, idx) => start - 1 + idx
      );
      const copied = await target.copyPages(source, pageIndexes);
      for (const page of copied) {
        target.addPage(page);
      }

      const out = path.join(
        path.dirname(inputPath),
        `${path.basename(inputPath, path.extname(inputPath))}.part-${i + 1}.pdf`
      );
      await fs.writeFile(out, await target.save());
      outputPaths.push(out);
    }

    return outputPaths;
  }
}
