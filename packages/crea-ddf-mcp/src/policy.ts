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
  "ModificationTimestamp"
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
  "Longitude"
] as const;

export const MEDIA_SAFE_FIELDS = [
  "MediaKey",
  "MediaURL",
  "MediaCategory",
  "MediaCaption",
  "Order",
  "ModificationTimestamp"
] as const;

export function intersectSelect(requested: string[] | undefined, allow: readonly string[]) {
  if (!requested?.length) {
    return [...allow];
  }
  const allowSet = new Set(allow);
  const filtered = requested.filter((field) => allowSet.has(field));
  return filtered.length ? filtered : [...allow];
}

export function parseOrderBy(input: unknown, allowFields: readonly string[]): string | undefined {
  if (input == null || input === "") {
    return undefined;
  }
  if (typeof input !== "string") {
    throw new Error("orderBy must be a string");
  }

  const match = input.trim().match(/^([A-Za-z0-9_]+)(?:\s+(asc|desc))?$/i);
  if (!match) {
    throw new Error("orderBy must match 'Field' or 'Field asc|desc'");
  }

  const field = match[1] as string;
  const direction = (match[2] ?? "asc").toLowerCase();

  if (!allowFields.includes(field)) {
    throw new Error(`orderBy field '${field}' is not allowed`);
  }

  return `${field} ${direction}`;
}
