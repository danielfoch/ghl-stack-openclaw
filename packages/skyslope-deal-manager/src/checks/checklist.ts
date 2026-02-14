import type { DocumentChecklist, ExtractedDocumentData } from "../types.js";

export function buildChecklist(data: ExtractedDocumentData): DocumentChecklist {
  const missing: string[] = [];

  const hasBuyerSellerInfo = data.buyers.length > 0 && data.sellers.length > 0;
  if (!hasBuyerSellerInfo) {
    missing.push("buyer_and_seller_info");
  }

  const hasRealtorInfo = data.realtors.length > 0;
  if (!hasRealtorInfo) {
    missing.push("realtor_info");
  }

  const hasLawyerOrEscrowInfo =
    data.lawyers.length > 0 || data.escrowOfficers.length > 0;
  if (!hasLawyerOrEscrowInfo) {
    missing.push("lawyer_or_escrow_info");
  }

  const hasClosingDate = Boolean(data.closingDate);
  if (!hasClosingDate) {
    missing.push("closing_date");
  }

  const hasConditionsCaptured =
    data.conditions.length > 0 || data.contingencies.length > 0;
  if (!hasConditionsCaptured) {
    missing.push("conditions_or_contingencies");
  }

  const hasClausesCaptured = data.clauses.length > 0;
  if (!hasClausesCaptured) {
    missing.push("clauses");
  }

  if (!data.initialsFound) {
    missing.push("initials");
  }

  if (!data.signaturesFound) {
    missing.push("signatures");
  }

  return {
    hasAllInitialsOrNAs: data.initialsFound,
    hasAllRequiredSignatures: data.signaturesFound,
    hasBuyerSellerInfo,
    hasRealtorInfo,
    hasLawyerOrEscrowInfo,
    hasClosingDate,
    hasConditionsCaptured,
    hasClausesCaptured,
    missingItems: missing
  };
}
