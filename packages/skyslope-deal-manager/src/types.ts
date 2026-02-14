export type DealType =
  | "APS"
  | "OTP"
  | "LEASE"
  | "LISTING"
  | "AMENDMENT"
  | "OTHER";

export interface Party {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface DealRecord {
  id: string;
  skyslopeTransactionId?: string;
  boardSystem?: string;
  name: string;
  dealType: DealType;
  address?: string;
  closingDate?: string;
  conditions?: string[];
  clauses?: string[];
  buyer?: Party;
  seller?: Party;
  realtor?: Party;
  lawyer?: Party;
  escrow?: Party;
  sourcePayload?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  dealId: string;
  filename: string;
  category: string;
  skyslopeFileId?: string;
  textExtract: string;
  extracted: ExtractedDocumentData;
  checklist: DocumentChecklist;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedDocumentData {
  initialsFound: boolean;
  signaturesFound: boolean;
  buyers: Party[];
  sellers: Party[];
  realtors: Party[];
  lawyers: Party[];
  escrowOfficers: Party[];
  closingDate?: string;
  conditions: string[];
  contingencies: string[];
  clauses: string[];
  rawSignals: string[];
}

export interface DocumentChecklist {
  hasAllInitialsOrNAs: boolean;
  hasAllRequiredSignatures: boolean;
  hasBuyerSellerInfo: boolean;
  hasRealtorInfo: boolean;
  hasLawyerOrEscrowInfo: boolean;
  hasClosingDate: boolean;
  hasConditionsCaptured: boolean;
  hasClausesCaptured: boolean;
  missingItems: string[];
}

export interface NamingRuleResult {
  valid: boolean;
  normalized: string;
  reason?: string;
}
