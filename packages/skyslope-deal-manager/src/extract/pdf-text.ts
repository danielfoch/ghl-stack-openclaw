import { promises as fs } from "node:fs";

export async function extractTextFromPdf(filePath: string): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default as (
    data: Buffer
  ) => Promise<{ text: string }>;
  const data = await fs.readFile(filePath);
  const parsed = await pdfParse(data);
  return parsed.text;
}
