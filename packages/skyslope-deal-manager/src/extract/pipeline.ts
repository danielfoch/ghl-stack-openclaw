import type { ExtractedDocumentData, Party } from "../types.js";
import type { LangExtractPlugin } from "../plugins/interfaces.js";

function extractEmails(text: string): string[] {
  return [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(
    (m) => m[0]
  );
}

function extractDate(text: string): string | undefined {
  const iso = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (iso?.[0]) {
    return iso[0].replace(/\//g, "-");
  }
  const monthName = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\b/i
  );
  return monthName?.[0];
}

function findPartiesByRole(text: string, role: string): Party[] {
  const re = new RegExp(`${role}\\s*[:\\-]\\s*([^\\n\\r]+)`, "gi");
  const results: Party[] = [];
  for (const m of text.matchAll(re)) {
    const name = m[1]?.trim();
    if (name) {
      results.push({ role, name });
    }
  }
  return results;
}

function extractListByKeyword(text: string, keyword: string): string[] {
  const lines = text.split(/\r?\n/);
  return lines
    .filter((line) => line.toLowerCase().includes(keyword.toLowerCase()))
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function extractDocumentData(
  text: string,
  langExtract: LangExtractPlugin
): Promise<ExtractedDocumentData> {
  const lower = text.toLowerCase();
  const structured = (await langExtract
    .extractStructured(text)
    .catch(() => ({}))) as Record<string, unknown>;

  const conditions = extractListByKeyword(text, "condition");
  const contingencies = extractListByKeyword(text, "contingenc");
  const clauses = extractListByKeyword(text, "clause");

  const emails = extractEmails(text);
  const partiesFromStructured = (structured["parties"] as Party[] | undefined) ?? [];

  return {
    initialsFound: /\binitial(?:s|ed)?\b/i.test(text) || /\bint\.?\b/i.test(text),
    signaturesFound:
      /\bsignature\b/i.test(text) ||
      /\be-sign\b/i.test(text) ||
      /\belectronic signature\b/i.test(text),
    buyers: [
      ...findPartiesByRole(text, "buyer"),
      ...partiesFromStructured.filter((p) => p.role?.toLowerCase() === "buyer")
    ],
    sellers: [
      ...findPartiesByRole(text, "seller"),
      ...partiesFromStructured.filter((p) => p.role?.toLowerCase() === "seller")
    ],
    realtors: [
      ...findPartiesByRole(text, "realtor"),
      ...findPartiesByRole(text, "agent")
    ],
    lawyers: [
      ...findPartiesByRole(text, "lawyer"),
      ...findPartiesByRole(text, "solicitor")
    ],
    escrowOfficers: [
      ...findPartiesByRole(text, "escrow"),
      ...findPartiesByRole(text, "title officer")
    ],
    closingDate: extractDate(text),
    conditions,
    contingencies,
    clauses,
    rawSignals: [
      ...emails,
      ...(lower.includes("closing date") ? ["closing_date_phrase"] : []),
      ...(lower.includes("escrow") ? ["escrow_phrase"] : [])
    ]
  };
}
