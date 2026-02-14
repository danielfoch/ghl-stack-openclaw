import Database from "better-sqlite3";

export type PersistedMessage = {
  idempotencyKey: string;
  correlationId: string;
  channel: string;
  provider: string;
  providerMessageId: string;
  recipient: string;
  bodyHash: string;
  personId?: number;
  leadId?: string;
  sentAt: string;
  contentEncrypted?: string;
};

export class AppStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        result_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_message_id TEXT NOT NULL,
        recipient TEXT NOT NULL,
        body_hash TEXT NOT NULL,
        person_id INTEGER,
        lead_id TEXT,
        sent_at TEXT NOT NULL,
        content_encrypted TEXT
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        event_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        received_at TEXT NOT NULL,
        UNIQUE(provider, event_id)
      );

      CREATE TABLE IF NOT EXISTS contact_cache (
        external_key TEXT PRIMARY KEY,
        person_id INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  getIdempotentResult(key: string): string | null {
    const row = this.db.prepare("SELECT result_json FROM idempotency_keys WHERE key = ?").get(key) as { result_json: string | null } | undefined;
    return row?.result_json ?? null;
  }

  storeIdempotency(key: string, action: string, correlationId: string, resultJson: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO idempotency_keys (key, action, correlation_id, result_json, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(key, action, correlationId, resultJson);
  }

  hasWebhookEvent(provider: string, eventId: string): boolean {
    const row = this.db.prepare("SELECT 1 FROM webhook_events WHERE provider = ? AND event_id = ?").get(provider, eventId);
    return Boolean(row);
  }

  storeWebhookEvent(provider: string, eventId: string, payload: unknown, receivedAt: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO webhook_events(provider, event_id, payload_json, received_at)
      VALUES (?, ?, ?, ?)
    `).run(provider, eventId, JSON.stringify(payload), receivedAt);
  }

  storeMessageLog(message: PersistedMessage): void {
    this.db.prepare(`
      INSERT INTO message_logs (
        idempotency_key, correlation_id, channel, provider, provider_message_id,
        recipient, body_hash, person_id, lead_id, sent_at, content_encrypted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.idempotencyKey,
      message.correlationId,
      message.channel,
      message.provider,
      message.providerMessageId,
      message.recipient,
      message.bodyHash,
      message.personId ?? null,
      message.leadId ?? null,
      message.sentAt,
      message.contentEncrypted ?? null
    );
  }

  getCachedPerson(externalKey: string): number | null {
    const row = this.db.prepare("SELECT person_id FROM contact_cache WHERE external_key = ?").get(externalKey) as { person_id: number } | undefined;
    return row?.person_id ?? null;
  }

  setCachedPerson(externalKey: string, personId: number): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO contact_cache(external_key, person_id, updated_at)
      VALUES (?, ?, datetime('now'))
    `).run(externalKey, personId);
  }
}
