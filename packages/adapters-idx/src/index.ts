import type { IdxAdapter, Listing } from "@fub/core";

export class MockIdxAdapter implements IdxAdapter {
  private readonly listings: Listing[] = [
    {
      id: "1",
      mlsId: "MLS-100",
      address: "123 Main St",
      city: "Toronto",
      status: "Active",
      price: 899000,
      dom: 12,
      lastUpdated: "2026-02-13T10:22:00.000Z",
      beds: 3,
      baths: 2,
      sqft: 1600
    },
    {
      id: "2",
      mlsId: "MLS-101",
      address: "77 King St",
      city: "Toronto",
      status: "Conditional",
      price: 725000,
      dom: 5,
      lastUpdated: "2026-02-14T11:00:00.000Z",
      beds: 2,
      baths: 2,
      sqft: 1100
    }
  ];

  async searchListings(query: Record<string, string | number | boolean>): Promise<Listing[]> {
    const city = typeof query.city === "string" ? query.city.toLowerCase() : undefined;
    const minBeds = typeof query.minBeds === "number" ? query.minBeds : undefined;
    const maxPrice = typeof query.maxPrice === "number" ? query.maxPrice : undefined;

    return this.listings.filter((l) => {
      if (city && l.city?.toLowerCase() !== city) return false;
      if (minBeds && (l.beds ?? 0) < minBeds) return false;
      if (maxPrice && (l.price ?? Number.MAX_SAFE_INTEGER) > maxPrice) return false;
      return true;
    });
  }

  async getListingByMlsId(id: string): Promise<Listing | null> {
    return this.listings.find((l) => l.mlsId?.toLowerCase() === id.toLowerCase()) ?? null;
  }

  async getListingByAddress(address: string): Promise<Listing | null> {
    return this.listings.find((l) => l.address.toLowerCase() === address.toLowerCase()) ?? null;
  }

  async getAgentListings(_agentId: string): Promise<Listing[]> {
    return this.listings;
  }

  async enrichContactContext(personId: number): Promise<Record<string, unknown>> {
    return {
      personId,
      savedSearches: ["Toronto 2+ beds under 900k"],
      viewedListings: ["MLS-100", "MLS-101"]
    };
  }
}

export class HttpIdxAdapter implements IdxAdapter {
  constructor(private readonly opts: { baseUrl: string; apiKey: string }) {}

  async searchListings(query: Record<string, string | number | boolean>): Promise<Listing[]> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) params.set(k, String(v));
    return this.request<Listing[]>(`/listings/search?${params.toString()}`);
  }

  async getListingByMlsId(id: string): Promise<Listing | null> {
    return this.request<Listing | null>(`/listings/mls/${encodeURIComponent(id)}`);
  }

  async getListingByAddress(address: string): Promise<Listing | null> {
    return this.request<Listing | null>(`/listings/address/${encodeURIComponent(address)}`);
  }

  async getAgentListings(agentId: string): Promise<Listing[]> {
    return this.request<Listing[]>(`/agents/${encodeURIComponent(agentId)}/listings`);
  }

  async enrichContactContext(personId: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/contacts/${personId}/context`);
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.opts.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`
      }
    });

    if (!response.ok) throw new Error(`IDX request failed: ${response.status}`);
    return (await response.json()) as T;
  }
}
