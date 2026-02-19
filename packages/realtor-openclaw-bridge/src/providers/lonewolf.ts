import { AppConfig } from "../config.js";
import {
  BridgeResource,
  OpenClawBridgeEvent,
  ProviderPullResult,
  ProviderPushResult,
  PullRequest
} from "../types.js";
import { ProviderAdapter, ProviderHealth } from "./interfaces.js";

const resourcePath: Record<BridgeResource, string> = {
  offers: "/transact-workflow/v1/Users/{userId}/Offers",
  folders: "/transact-workflow/v1/Users/{userId}/Folders",
  documents: "/transact-workflow/v1/users/{userId}/documents",
  listings: "/transact-workflow/v1/Users/{userId}/Offers",
  contacts: "/transact-workflow/v1/Users/{userId}/Contacts",
  custom: "/transact-workflow/v1/Users/{userId}/Offers"
};

export class LoneWolfProvider implements ProviderAdapter {
  readonly name = "lonewolf" as const;

  constructor(private readonly cfg: AppConfig) {}

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.cfg.LONEWOLF_USER_ID) {
      return {
        provider: this.name,
        ok: false,
        detail: "Missing LONEWOLF_USER_ID"
      };
    }

    try {
      await this.request(
        "GET",
        resourcePath.offers.replace("{userId}", this.cfg.LONEWOLF_USER_ID)
      );
      return {
        provider: this.name,
        ok: true,
        detail: "Lone Wolf API reachable"
      };
    } catch (error) {
      return {
        provider: this.name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async pull(input: PullRequest): Promise<ProviderPullResult> {
    const userId = input.userId ?? this.cfg.LONEWOLF_USER_ID;
    if (!userId) {
      throw new Error("Lone Wolf pull requires userId or LONEWOLF_USER_ID");
    }

    const path = resourcePath[input.resource].replace("{userId}", userId);
    const qs = new URLSearchParams();
    if (input.filter) {
      qs.set("$filter", input.filter);
    }

    const response = await this.request(
      "GET",
      `${path}${qs.toString() ? `?${qs.toString()}` : ""}`
    );
    const records = asArray(response);

    return {
      provider: this.name,
      resource: input.resource,
      records,
      raw: response
    };
  }

  async push(event: OpenClawBridgeEvent): Promise<ProviderPushResult> {
    const userId = this.cfg.LONEWOLF_USER_ID;
    if (!userId) {
      throw new Error("LONEWOLF_USER_ID is required for push");
    }

    const targetPath =
      event.entityType === "contact"
        ? `/transact-workflow/v1/Users/${encodeURIComponent(userId)}/Contacts`
        : `/transact-workflow/v1/Users/${encodeURIComponent(userId)}/Offers`;

    const response = await this.request("POST", targetPath, event.payload);

    return {
      provider: this.name,
      accepted: true,
      response
    };
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    payload?: unknown
  ): Promise<unknown> {
    const url = new URL(path, this.cfg.LONEWOLF_BASE_URL);
    const headers: Record<string, string> = {
      Accept: "application/json"
    };

    if (payload !== undefined) {
      headers["content-type"] = "application/json";
    }

    if (this.cfg.LONEWOLF_BEARER_TOKEN) {
      headers.Authorization = `Bearer ${this.cfg.LONEWOLF_BEARER_TOKEN}`;
    }

    if (this.cfg.LONEWOLF_SUBSCRIPTION_KEY) {
      headers["lw-subscription-key"] = this.cfg.LONEWOLF_SUBSCRIPTION_KEY;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.LONEWOLF_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: controller.signal
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Lone Wolf ${method} ${url.pathname} failed (${res.status}): ${body}`);
      }

      const bodyText = await res.text();
      if (!bodyText) {
        return { ok: true };
      }
      try {
        return JSON.parse(bodyText) as unknown;
      } catch {
        return { raw: bodyText };
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

function asArray(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const firstArray = Object.values(obj).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) {
      return firstArray;
    }
  }
  return [];
}
