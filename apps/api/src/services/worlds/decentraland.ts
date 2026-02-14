import { WorldAdapter, Parcel } from "./types";

const BASE = "https://api.decentraland.org/v2";

function normalizeParcelId(x: number, y: number): string {
  return `${x},${y}`;
}

function mapParcel(raw: any): Parcel {
  const parcel = raw?.data ?? raw;
  const x = Number(parcel?.x);
  const y = Number(parcel?.y);

  return {
    parcelId: normalizeParcelId(x, y),
    world: "DECENTRALAND",
    x,
    y,
    ownerAddress: parcel?.owner?.toLowerCase?.() || parcel?.owner_address?.toLowerCase?.(),
    name: parcel?.name || undefined,
    description: parcel?.description || undefined,
    image: parcel?.image || undefined,
    raw,
  };
}

export const decentralandAdapter: WorldAdapter = {
  world: "DECENTRALAND",
  normalizeParcelId: ({ x, y }) => normalizeParcelId(x, y),
  async getParcel(x, y) {
    const res = await fetch(`${BASE}/parcels/${x}/${y}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    return mapParcel(json);
  },
  async searchParcels(query) {
    const params = new URLSearchParams({
      x1: String(query.xMin),
      x2: String(query.xMax),
      y1: String(query.yMin),
      y2: String(query.yMax),
    });

    const res = await fetch(`${BASE}/parcels?${params.toString()}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map(mapParcel);
  },
};
