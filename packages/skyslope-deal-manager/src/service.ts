import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { AppConfig } from "./config.js";
import { buildChecklist } from "./checks/checklist.js";
import { extractDocumentData } from "./extract/pipeline.js";
import { extractTextFromPdf } from "./extract/pdf-text.js";
import type { DealType, DealRecord, DocumentRecord } from "./types.js";
import { suggestDealName, validateDealName } from "./naming/rules.js";
import { DealStore } from "./store/deal-store.js";
import { SkySlopeClient } from "./skyslope/client.js";
import { HttpLangExtractPlugin } from "./plugins/langextract.js";

export class DealManagerService {
  readonly store: DealStore;
  readonly skyslope: SkySlopeClient;
  private readonly langextract: HttpLangExtractPlugin;

  constructor(readonly cfg: AppConfig) {
    this.store = new DealStore(cfg.DEAL_DB_PATH);
    this.skyslope = new SkySlopeClient(cfg);
    this.langextract = new HttpLangExtractPlugin(
      cfg.LANGEXTRACT_ENDPOINT,
      cfg.LANGEXTRACT_API_KEY
    );
  }

  async syncTransaction(transactionId: string): Promise<DealRecord> {
    const data = (await this.skyslope.getTransaction(transactionId)) as Record<
      string,
      unknown
    >;
    const now = new Date().toISOString();

    const address =
      (data.address as string | undefined) ??
      (data.propertyAddress as string | undefined) ??
      "UNKNOWNADDRESS";
    const dealType = this.detectDealType(data);
    const name = suggestDealName(address, dealType);

    const record: DealRecord = {
      id: transactionId,
      skyslopeTransactionId: transactionId,
      boardSystem: "skyslope",
      name,
      dealType,
      address,
      closingDate: (data.closingDate as string | undefined) ?? undefined,
      conditions: [],
      clauses: [],
      buyer: undefined,
      seller: undefined,
      realtor: undefined,
      lawyer: undefined,
      escrow: undefined,
      sourcePayload: data,
      createdAt: now,
      updatedAt: now
    };

    return this.store.upsertDeal(record);
  }

  validateNaming(name: string) {
    return validateDealName(name);
  }

  suggestNaming(address: string, type: DealType) {
    return suggestDealName(address, type);
  }

  private detectDealType(payload: Record<string, unknown>): DealType {
    const t = String(payload.dealType ?? payload.transactionType ?? "").toLowerCase();
    if (t.includes("agreement") || t.includes("purchase")) return "APS";
    if (t.includes("offer")) return "OTP";
    if (t.includes("lease")) return "LEASE";
    if (t.includes("listing")) return "LISTING";
    if (t.includes("amend")) return "AMENDMENT";
    return "OTHER";
  }

  async ingestDocument(params: {
    dealId: string;
    filename?: string;
    text: string;
    category?: string;
    skyslopeFileId?: string;
  }): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    if (!this.store.getDealById(params.dealId)) {
      this.store.upsertDeal({
        id: params.dealId,
        name: `${params.dealId}_DOC`,
        dealType: "OTHER",
        createdAt: now,
        updatedAt: now
      });
    }
    const extracted = await extractDocumentData(params.text, this.langextract);
    const checklist = buildChecklist(extracted);

    const doc: DocumentRecord = {
      id: this.hash(`${params.dealId}|${params.filename ?? "doc"}|${now}`),
      dealId: params.dealId,
      filename: params.filename ?? "raw-text-input.txt",
      category: params.category ?? "uncategorized",
      skyslopeFileId: params.skyslopeFileId,
      textExtract: params.text,
      extracted,
      checklist,
      createdAt: now,
      updatedAt: now
    };

    return this.store.upsertDocument(doc);
  }

  async ingestTextFile(params: {
    dealId: string;
    filePath: string;
    category?: string;
  }): Promise<DocumentRecord> {
    const content = await fs.readFile(params.filePath, "utf8");
    return this.ingestDocument({
      dealId: params.dealId,
      filename: path.basename(params.filePath),
      text: content,
      category: params.category
    });
  }

  async ingestPdfFile(params: {
    dealId: string;
    filePath: string;
    category?: string;
  }): Promise<DocumentRecord> {
    const content = await extractTextFromPdf(params.filePath);
    return this.ingestDocument({
      dealId: params.dealId,
      filename: path.basename(params.filePath),
      text: content,
      category: params.category ?? "pdf"
    });
  }

  getDeal(dealId: string) {
    return this.store.getDealById(dealId);
  }

  queryDeals(query: string) {
    return this.store.queryDeals(query);
  }

  listDocumentsForDeal(dealId: string) {
    return this.store.listDocumentsForDeal(dealId);
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex").slice(0, 24);
  }
}
