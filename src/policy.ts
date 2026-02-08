// Compliance gating: tools only allow selecting from these allowlists.

export const PROPERTY_SAFE_SUMMARY_FIELDS = [
  "ListingKey",
  "ListPrice",
  "UnparsedAddress",
  "City",
  "StateOrProvince",
  "PostalCode",
  "BedroomsTotal",
  "BathroomsTotalInteger",
  "LivingArea",
  "PropertyType",
  "PropertySubType",
  "StandardStatus",
  "ModificationTimestamp",
] as const;

export const PROPERTY_SAFE_DETAIL_FIELDS = [
  ...PROPERTY_SAFE_SUMMARY_FIELDS,
  "YearBuilt",
  "LotSizeArea",
  "LotSizeUnits",
  "ArchitecturalStyle",
  "Heating",
  "Cooling",
  "ParkingTotal",
  "GarageSpaces",
  "Stories",
  "AssociationFee",
  "TaxAnnualAmount",
  "Latitude",
  "Longitude",
] as const;

export const MEDIA_SAFE_FIELDS = [
  "MediaKey",
  "MediaURL",
  "MediaCategory",
  "MediaCaption",
  "Order",
  "ModificationTimestamp",
] as const;

export function intersectSelect(requested: string[] | undefined, allow: readonly string[]) {
  if (!requested?.length) return allow.slice();
  const set = new Set(allow);
  const filtered = requested.filter((f) => set.has(f));
  return filtered.length ? filtered : allow.slice();
}

export function parseOrderBy(
  input: unknown,
  allowFields: readonly string[]
): { ok: true; value?: string } | { ok: false; error: string } {
  if (input == null || input === "") return { ok: true, value: undefined };
  if (typeof input !== "string") return { ok: false, error: "orderBy must be a string like 'ListPrice desc'" };

  // Accept "Field" or "Field asc|desc" only.
  const m = input.trim().match(/^([A-Za-z0-9_]+)(?:\s+(asc|desc))?$/i);
  if (!m) return { ok: false, error: "orderBy must look like 'Field' or 'Field asc|desc'" };
  const field = m[1]!;
  const dir = (m[2] ?? "asc").toLowerCase();
  if (!allowFields.includes(field)) return { ok: false, error: `orderBy field '${field}' is not allowed` };
  return { ok: true, value: `${field} ${dir}` };
}

