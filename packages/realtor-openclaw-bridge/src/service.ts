import { AppConfig } from "./config.js";
import { createFaltourProvider } from "./providers/faltour.js";
import { ProviderAdapter } from "./providers/interfaces.js";
import { LoneWolfProvider } from "./providers/lonewolf.js";
import { createNexoneProvider } from "./providers/nexone.js";
import { BridgeStore } from "./store/bridge-store.js";
import {
  BridgeProviderName,
  OpenClawBridgeEvent,
  OpenClawEntityType,
  PullRequest
} from "./types.js";

export class RealtorBridgeService {
  private readonly providers: Record<BridgeProviderName, ProviderAdapter>;
  private readonly store: BridgeStore;

  constructor(private readonly cfg: AppConfig) {
    this.store = new BridgeStore(cfg.OPENCLAW_BRIDGE_DB_PATH);
    this.providers = {
      lonewolf: new LoneWolfProvider(cfg),
      nexone: createNexoneProvider(cfg),
      faltour: createFaltourProvider(cfg)
    };
  }

  async health(provider: BridgeProviderName) {
    return this.requireProvider(provider).healthCheck();
  }

  async pull(provider: BridgeProviderName, input: PullRequest, cursorKey?: string) {
    const p = this.requireProvider(provider);
    const normalizedLimit =
      input.limit === undefined
        ? undefined
        : Number.isInteger(input.limit) && input.limit > 0
          ? input.limit
          : undefined;
    const activeCursorKey = cursorKey ?? `${input.resource}:${input.userId ?? "default"}`;
    const cursor = input.cursor ?? this.store.getCursor(provider, activeCursorKey);

    const output = await p.pull({ ...input, cursor, limit: normalizedLimit });
    this.store.logEvent({
      id: randomId("pull"),
      source: "openclaw",
      provider,
      direction: "pull",
      status: "ok",
      payload: { input: { ...input, cursor, limit: normalizedLimit }, cursorKey: activeCursorKey },
      response: output.raw,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (output.nextCursor) {
      this.store.setCursor(provider, activeCursorKey, output.nextCursor);
    }

    return output;
  }

  async push(
    provider: BridgeProviderName,
    event: Omit<OpenClawBridgeEvent, "id" | "source" | "createdAt"> & {
      id?: string;
      source?: "openclaw";
      createdAt?: string;
    }
  ) {
    const p = this.requireProvider(provider);
    const normalized = this.normalizeEvent(event);

    try {
      const response = await p.push(normalized);
      this.store.logEvent({
        id: normalized.id,
        source: normalized.source,
        provider,
        direction: "push",
        status: "ok",
        payload: normalized,
        response: response.response,
        createdAt: normalized.createdAt,
        updatedAt: new Date().toISOString()
      });
      return response;
    } catch (error) {
      this.store.logEvent({
        id: normalized.id,
        source: normalized.source,
        provider,
        direction: "push",
        status: "error",
        payload: normalized,
        error: error instanceof Error ? error.message : String(error),
        createdAt: normalized.createdAt,
        updatedAt: new Date().toISOString()
      });
      throw error;
    }
  }

  async fanout(
    providers: BridgeProviderName[],
    event: Omit<OpenClawBridgeEvent, "id" | "source" | "createdAt"> & {
      id?: string;
      source?: "openclaw";
      createdAt?: string;
    }
  ) {
    const out = [] as Array<{ provider: BridgeProviderName; ok: boolean; result: unknown }>;
    for (const provider of providers) {
      try {
        out.push({
          provider,
          ok: true,
          result: await this.push(provider, event)
        });
      } catch (error) {
        out.push({
          provider,
          ok: false,
          result: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return out;
  }

  recentEvents(limit = 25) {
    const normalizedLimit =
      Number.isInteger(limit) && limit > 0 ? limit : 25;
    return this.store.listRecentEvents(normalizedLimit);
  }

  private requireProvider(provider: BridgeProviderName): ProviderAdapter {
    const p = this.providers[provider];
    if (!p) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return p;
  }

  private normalizeEvent(
    event: Omit<OpenClawBridgeEvent, "id" | "source" | "createdAt"> & {
      id?: string;
      source?: "openclaw";
      createdAt?: string;
    }
  ): OpenClawBridgeEvent {
    return {
      id: event.id ?? randomId("event"),
      source: event.source ?? "openclaw",
      entityType: event.entityType as OpenClawEntityType,
      payload: event.payload,
      createdAt: event.createdAt ?? new Date().toISOString()
    };
  }
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
