import type { KeyStyle } from "./config.js";

export function escODataString(s: string) {
  return s.replace(/'/g, "''");
}

export function toODataDateTimeOffsetLiteral(input: string) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("updatedSince must be a valid ISO 8601 datetime");
  // Use canonical UTC form to avoid injection and inconsistent formats.
  return d.toISOString();
}

// Strict filter compiler (no raw $filter input).
export function toPropertyFilter(filters: any): string | undefined {
  const parts: string[] = [];

  if (filters?.city) parts.push(`City eq '${escODataString(String(filters.city))}'`);
  if (filters?.province) parts.push(`StateOrProvince eq '${escODataString(String(filters.province))}'`);
  if (filters?.postalCode) parts.push(`PostalCode eq '${escODataString(String(filters.postalCode))}'`);

  if (filters?.minPrice != null) parts.push(`ListPrice ge ${Number(filters.minPrice)}`);
  if (filters?.maxPrice != null) parts.push(`ListPrice le ${Number(filters.maxPrice)}`);
  if (filters?.minBeds != null) parts.push(`BedroomsTotal ge ${Number(filters.minBeds)}`);
  if (filters?.minBaths != null) parts.push(`BathroomsTotalInteger ge ${Number(filters.minBaths)}`);
  if (filters?.status) parts.push(`StandardStatus eq '${escODataString(String(filters.status))}'`);

  if (filters?.updatedSince) {
    const literal = toODataDateTimeOffsetLiteral(String(filters.updatedSince));
    parts.push(`ModificationTimestamp ge ${literal}`);
  }

  return parts.length ? parts.join(" and ") : undefined;
}

export function propertyKeyPath(id: string, style: KeyStyle) {
  // RESO Web API commonly uses Property('ListingKey') for string keys.
  // Some deployments use numeric keys (Property(123)).
  return style === "quoted" ? `/Property('${escODataString(id)}')` : `/Property(${id})`;
}

export function urlJoin(base: string, path: string) {
  const u = new URL(base);
  // URL(path, base) drops base path segments; preserve by manual join.
  const basePath = u.pathname.endsWith("/") ? u.pathname.slice(0, -1) : u.pathname;
  const p = path.startsWith("/") ? path : `/${path}`;
  u.pathname = `${basePath}${p}`;
  return u.toString();
}

