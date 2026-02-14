import type { DealType, NamingRuleResult } from "../types.js";

const TYPE_SUFFIX: Record<DealType, string> = {
  APS: "APS",
  OTP: "OTP",
  LEASE: "LEASE",
  LISTING: "LISTING",
  AMENDMENT: "AMEND",
  OTHER: "DOC"
};

function normalizeAddressStem(address: string): string {
  return address
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(STREET|ST)$/, "ST")
    .replace(/(AVENUE|AVE)$/, "AVE")
    .slice(0, 24);
}

export function suggestDealName(address: string, type: DealType): string {
  const stem = normalizeAddressStem(address);
  return `${stem}_${TYPE_SUFFIX[type]}`;
}

export function validateDealName(name: string): NamingRuleResult {
  const trimmed = name.trim().toUpperCase();
  const re = /^[A-Z0-9]{3,24}_(APS|OTP|LEASE|LISTING|AMEND|DOC)$/;
  if (!re.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed,
      reason:
        "Expected format ADDRESSSTEM_SUFFIX (example: 123MAINST_APS). Allowed suffixes: APS, OTP, LEASE, LISTING, AMEND, DOC."
    };
  }
  return { valid: true, normalized: trimmed };
}
