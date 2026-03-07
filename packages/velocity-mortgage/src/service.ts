import { loadConfig } from "./config.js";
import { VelocityClient } from "./client.js";
import { VelocityGetDealsQuery } from "./types.js";

export class VelocityService {
  private readonly client = new VelocityClient(loadConfig());

  createContact(payload: Record<string, unknown>) {
    return this.client.createContact(payload);
  }

  getSampleContact() {
    return this.client.getSampleContact();
  }

  createDeal(payload: Record<string, unknown>) {
    return this.client.createDeal(payload);
  }

  getSampleDeal() {
    return this.client.getSampleDeal();
  }

  getDeals(query: VelocityGetDealsQuery) {
    return this.client.getDeals(query);
  }

  searchDeals(payload: Record<string, unknown>) {
    return this.client.searchDeals(payload);
  }

  request(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    query?: Record<string, string | number | boolean | null | undefined>,
    body?: unknown
  ) {
    return this.client.request(method, path, {
      query,
      body
    });
  }
}
