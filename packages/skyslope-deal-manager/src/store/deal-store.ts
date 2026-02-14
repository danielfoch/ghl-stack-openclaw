import Database from "better-sqlite3";
import type { DealRecord, DocumentRecord } from "../types.js";

export class DealStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        skyslope_transaction_id TEXT,
        board_system TEXT,
        name TEXT NOT NULL,
        deal_type TEXT NOT NULL,
        address TEXT,
        closing_date TEXT,
        conditions_json TEXT,
        clauses_json TEXT,
        buyer_json TEXT,
        seller_json TEXT,
        realtor_json TEXT,
        lawyer_json TEXT,
        escrow_json TEXT,
        source_payload_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        category TEXT NOT NULL,
        skyslope_file_id TEXT,
        text_extract TEXT NOT NULL,
        extracted_json TEXT NOT NULL,
        checklist_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (deal_id) REFERENCES deals(id)
      );

      CREATE INDEX IF NOT EXISTS idx_deals_name ON deals(name);
      CREATE INDEX IF NOT EXISTS idx_docs_deal ON documents(deal_id);
    `);
  }

  upsertDeal(deal: DealRecord): DealRecord {
    const stmt = this.db.prepare(`
      INSERT INTO deals (
        id, skyslope_transaction_id, board_system, name, deal_type, address, closing_date,
        conditions_json, clauses_json, buyer_json, seller_json, realtor_json, lawyer_json,
        escrow_json, source_payload_json, created_at, updated_at
      ) VALUES (
        @id, @skyslope_transaction_id, @board_system, @name, @deal_type, @address, @closing_date,
        @conditions_json, @clauses_json, @buyer_json, @seller_json, @realtor_json, @lawyer_json,
        @escrow_json, @source_payload_json, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        skyslope_transaction_id = excluded.skyslope_transaction_id,
        board_system = excluded.board_system,
        name = excluded.name,
        deal_type = excluded.deal_type,
        address = excluded.address,
        closing_date = excluded.closing_date,
        conditions_json = excluded.conditions_json,
        clauses_json = excluded.clauses_json,
        buyer_json = excluded.buyer_json,
        seller_json = excluded.seller_json,
        realtor_json = excluded.realtor_json,
        lawyer_json = excluded.lawyer_json,
        escrow_json = excluded.escrow_json,
        source_payload_json = excluded.source_payload_json,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id: deal.id,
      skyslope_transaction_id: deal.skyslopeTransactionId ?? null,
      board_system: deal.boardSystem ?? null,
      name: deal.name,
      deal_type: deal.dealType,
      address: deal.address ?? null,
      closing_date: deal.closingDate ?? null,
      conditions_json: JSON.stringify(deal.conditions ?? []),
      clauses_json: JSON.stringify(deal.clauses ?? []),
      buyer_json: JSON.stringify(deal.buyer ?? {}),
      seller_json: JSON.stringify(deal.seller ?? {}),
      realtor_json: JSON.stringify(deal.realtor ?? {}),
      lawyer_json: JSON.stringify(deal.lawyer ?? {}),
      escrow_json: JSON.stringify(deal.escrow ?? {}),
      source_payload_json: JSON.stringify(deal.sourcePayload ?? {}),
      created_at: deal.createdAt,
      updated_at: deal.updatedAt
    });

    return deal;
  }

  upsertDocument(doc: DocumentRecord): DocumentRecord {
    const stmt = this.db.prepare(`
      INSERT INTO documents (
        id, deal_id, filename, category, skyslope_file_id, text_extract,
        extracted_json, checklist_json, created_at, updated_at
      ) VALUES (
        @id, @deal_id, @filename, @category, @skyslope_file_id, @text_extract,
        @extracted_json, @checklist_json, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        deal_id = excluded.deal_id,
        filename = excluded.filename,
        category = excluded.category,
        skyslope_file_id = excluded.skyslope_file_id,
        text_extract = excluded.text_extract,
        extracted_json = excluded.extracted_json,
        checklist_json = excluded.checklist_json,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id: doc.id,
      deal_id: doc.dealId,
      filename: doc.filename,
      category: doc.category,
      skyslope_file_id: doc.skyslopeFileId ?? null,
      text_extract: doc.textExtract,
      extracted_json: JSON.stringify(doc.extracted),
      checklist_json: JSON.stringify(doc.checklist),
      created_at: doc.createdAt,
      updated_at: doc.updatedAt
    });

    return doc;
  }

  getDealById(id: string): DealRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM deals WHERE id = ? LIMIT 1`)
      .get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapDeal(row);
  }

  queryDeals(query: string): DealRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM deals WHERE name LIKE @q OR address LIKE @q ORDER BY updated_at DESC LIMIT 50`
      )
      .all({ q: `%${query}%` }) as Array<Record<string, unknown>>;

    return rows.map((row) => this.mapDeal(row));
  }

  listDocumentsForDeal(dealId: string): DocumentRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM documents WHERE deal_id = ? ORDER BY updated_at DESC`)
      .all(dealId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapDocument(row));
  }

  private mapDeal(row: Record<string, unknown>): DealRecord {
    return {
      id: String(row.id),
      skyslopeTransactionId: (row.skyslope_transaction_id as string | null) ?? undefined,
      boardSystem: (row.board_system as string | null) ?? undefined,
      name: String(row.name),
      dealType: String(row.deal_type) as DealRecord["dealType"],
      address: (row.address as string | null) ?? undefined,
      closingDate: (row.closing_date as string | null) ?? undefined,
      conditions: JSON.parse(String(row.conditions_json ?? "[]")),
      clauses: JSON.parse(String(row.clauses_json ?? "[]")),
      buyer: JSON.parse(String(row.buyer_json ?? "{}")),
      seller: JSON.parse(String(row.seller_json ?? "{}")),
      realtor: JSON.parse(String(row.realtor_json ?? "{}")),
      lawyer: JSON.parse(String(row.lawyer_json ?? "{}")),
      escrow: JSON.parse(String(row.escrow_json ?? "{}")),
      sourcePayload: JSON.parse(String(row.source_payload_json ?? "{}")),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  private mapDocument(row: Record<string, unknown>): DocumentRecord {
    return {
      id: String(row.id),
      dealId: String(row.deal_id),
      filename: String(row.filename),
      category: String(row.category),
      skyslopeFileId: (row.skyslope_file_id as string | null) ?? undefined,
      textExtract: String(row.text_extract),
      extracted: JSON.parse(String(row.extracted_json ?? "{}")),
      checklist: JSON.parse(String(row.checklist_json ?? "{}")),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }
}
