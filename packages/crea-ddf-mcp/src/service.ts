import type { DdfConfig, PropertyFilters } from "./types.js";
import { DdfClient } from "./client.js";
import { escODataString, propertyKeyPath, toPropertyFilter } from "./odata.js";
import {
  intersectSelect,
  MEDIA_SAFE_FIELDS,
  PROPERTY_SAFE_DETAIL_FIELDS,
  PROPERTY_SAFE_SUMMARY_FIELDS,
  parseOrderBy
} from "./policy.js";

export class DdfService {
  private readonly client: DdfClient;

  constructor(private readonly config: DdfConfig) {
    this.client = new DdfClient(config);
  }

  async searchProperties(input: {
    filters?: PropertyFilters;
    top?: number;
    skip?: number;
    select?: string[];
    orderBy?: string;
    includeCount?: boolean;
  }) {
    const top = input.top ?? this.config.defaultTop;
    const skip = input.skip ?? 0;

    const $filter = toPropertyFilter(input.filters);
    const $select = intersectSelect(input.select, PROPERTY_SAFE_SUMMARY_FIELDS).join(",");
    const $orderby = parseOrderBy(input.orderBy, PROPERTY_SAFE_SUMMARY_FIELDS);

    const payload = (await this.client.get("/Property", {
      ...($filter ? { $filter } : {}),
      $top: String(top),
      $skip: String(skip),
      $select,
      ...($orderby ? { $orderby } : {}),
      ...(input.includeCount !== false ? { $count: "true" } : {})
    })) as any;

    return {
      count: payload?.["@odata.count"],
      next: { top, skip: skip + top },
      odata: {
        nextLink: payload?.["@odata.nextLink"]
      },
      results: payload?.value ?? payload
    };
  }

  async getProperty(input: { id: string; detail?: boolean; select?: string[] }) {
    const allow = input.detail === false ? PROPERTY_SAFE_SUMMARY_FIELDS : PROPERTY_SAFE_DETAIL_FIELDS;
    const $select = intersectSelect(input.select, allow).join(",");
    return this.client.get(propertyKeyPath(input.id, this.config.propertyKeyStyle), { $select });
  }

  async getPropertyMedia(input: { id: string; top?: number; skip?: number; select?: string[] }) {
    const $select = intersectSelect(input.select, MEDIA_SAFE_FIELDS).join(",");
    const top = input.top ?? Math.min(100, this.config.maxTop);
    const skip = input.skip ?? 0;

    const $filter = `${this.config.mediaRecordKeyField} eq '${escODataString(input.id)}'`;

    return this.client.get(`/${this.config.mediaEntity}`, {
      $filter,
      $top: String(top),
      $skip: String(skip),
      $select,
      $orderby: `${this.config.mediaOrderField} asc`
    });
  }

  async getMetadata() {
    return this.client.get("/$metadata");
  }

  async rawRequest(input: {
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: Record<string, unknown> | null;
    auth?: boolean;
  }) {
    return this.client.request(input.method, input.path, {
      query: input.query,
      body: input.body,
      auth: input.auth
    });
  }
}
