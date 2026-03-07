import type { PropertyFilters } from "./types.js";

export function escODataString(value: string): string {
  return value.replace(/'/g, "''");
}

export function toIsoDateTime(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("updatedSince must be a valid ISO 8601 datetime");
  }
  return dt.toISOString();
}

export function urlJoin(base: string, path: string): string {
  const u = new URL(base);
  const basePath = u.pathname.endsWith("/") ? u.pathname.slice(0, -1) : u.pathname;
  const p = path.startsWith("/") ? path : `/${path}`;
  u.pathname = `${basePath}${p}`;
  return u.toString();
}

export function toPropertyFilter(filters: PropertyFilters | undefined): string | undefined {
  if (!filters) {
    return undefined;
  }

  const parts: string[] = [];
  if (filters.city) parts.push(`City eq '${escODataString(filters.city)}'`);
  if (filters.province) parts.push(`StateOrProvince eq '${escODataString(filters.province)}'`);
  if (filters.postalCode) parts.push(`PostalCode eq '${escODataString(filters.postalCode)}'`);
  if (filters.minPrice != null) parts.push(`ListPrice ge ${filters.minPrice}`);
  if (filters.maxPrice != null) parts.push(`ListPrice le ${filters.maxPrice}`);
  if (filters.minBeds != null) parts.push(`BedroomsTotal ge ${filters.minBeds}`);
  if (filters.minBaths != null) parts.push(`BathroomsTotalInteger ge ${filters.minBaths}`);
  if (filters.status) parts.push(`StandardStatus eq '${escODataString(filters.status)}'`);
  if (filters.updatedSince) parts.push(`ModificationTimestamp ge ${toIsoDateTime(filters.updatedSince)}`);

  return parts.length ? parts.join(" and ") : undefined;
}

export function propertyKeyPath(id: string, style: "quoted" | "unquoted"): string {
  return style === "quoted" ? `/Property('${escODataString(id)}')` : `/Property(${id})`;
}
