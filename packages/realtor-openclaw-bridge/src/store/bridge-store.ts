import Database from "better-sqlite3";
import { BridgeEventLog, BridgeProviderName } from "../types.js";

export class BridgeStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bridge_events (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        provider TEXT NOT NULL,
        direction TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        response_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_cursors (
        provider TEXT NOT NULL,
        cursor_key TEXT NOT NULL,
        cursor_value TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (provider, cursor_key)
      );

      CREATE INDEX IF NOT EXISTS idx_bridge_events_provider_created
      ON bridge_events(provider, created_at DESC);
    `);
  }

  logEvent(log: BridgeEventLog): void {
    this.db
      .prepare(
        `
          INSERT INTO bridge_events (
            id, source, provider, direction, status, payload_json,
            response_json, error, created_at, updated_at
          ) VALUES (
            @id, @source, @provider, @direction, @status, @payload_json,
            @response_json, @error, @created_at, @updated_at
          )
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            payload_json = excluded.payload_json,
            response_json = excluded.response_json,
            error = excluded.error,
            updated_at = excluded.updated_at
        `
      )
      .run({
        id: log.id,
        source: log.source,
        provider: log.provider,
        direction: log.direction,
        status: log.status,
        payload_json: JSON.stringify(log.payload ?? {}),
        response_json: log.response === undefined ? null : JSON.stringify(log.response),
        error: log.error ?? null,
        created_at: log.createdAt,
        updated_at: log.updatedAt
      });
  }

  setCursor(provider: BridgeProviderName, key: string, value?: string): void {
    this.db
      .prepare(
        `
          INSERT INTO sync_cursors (provider, cursor_key, cursor_value, updated_at)
          VALUES (@provider, @cursor_key, @cursor_value, @updated_at)
          ON CONFLICT(provider, cursor_key) DO UPDATE SET
            cursor_value = excluded.cursor_value,
            updated_at = excluded.updated_at
        `
      )
      .run({
        provider,
        cursor_key: key,
        cursor_value: value ?? null,
        updated_at: new Date().toISOString()
      });
  }

  getCursor(provider: BridgeProviderName, key: string): string | undefined {
    const row = this.db
      .prepare(
        `SELECT cursor_value FROM sync_cursors WHERE provider = ? AND cursor_key = ? LIMIT 1`
      )
      .get(provider, key) as { cursor_value: string | null } | undefined;

    return row?.cursor_value ?? undefined;
  }

  listRecentEvents(limit = 25): BridgeEventLog[] {
    const rows = this.db
      .prepare(
        `
          SELECT * FROM bridge_events
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(limit) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id),
      source: String(row.source),
      provider: String(row.provider) as BridgeProviderName,
      direction: String(row.direction) as BridgeEventLog["direction"],
      status: String(row.status) as BridgeEventLog["status"],
      payload: JSON.parse(String(row.payload_json ?? "{}")),
      response: row.response_json ? JSON.parse(String(row.response_json)) : undefined,
      error: (row.error as string | null) ?? undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }));
  }
}
