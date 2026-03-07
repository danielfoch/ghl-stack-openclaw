import { XMLParser } from "fast-xml-parser";
import { SupplierFieldValue, SupplierFields } from "./types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true
});

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function valueToXml(tag: string, value: SupplierFieldValue): string {
  if (value === null || value === undefined) {
    return `<${tag} />`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => valueToXml(tag, item)).join("");
  }

  if (typeof value === "object") {
    const inner = Object.entries(value)
      .map(([k, v]) => valueToXml(k, v))
      .join("");
    return `<${tag}>${inner}</${tag}>`;
  }

  return `<${tag}>${escapeXml(String(value))}</${tag}>`;
}

export function fieldsToXml(fields: SupplierFields): string {
  return Object.entries(fields)
    .map(([key, value]) => valueToXml(key, value))
    .join("");
}

export function parseXml(xml: string): unknown {
  return parser.parse(xml);
}

export function stripPrefix(tagName: string): string {
  const idx = tagName.indexOf(":");
  return idx >= 0 ? tagName.slice(idx + 1) : tagName;
}

export function findNodeByLocalName(
  input: unknown,
  localName: string
): unknown | undefined {
  if (!input || typeof input !== "object") return undefined;

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findNodeByLocalName(item, localName);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (stripPrefix(key) === localName) {
      return value;
    }

    const found = findNodeByLocalName(value, localName);
    if (found !== undefined) return found;
  }

  return undefined;
}
