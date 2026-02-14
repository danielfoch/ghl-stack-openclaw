export type Parcel = {
  parcelId: string;
  world: "DECENTRALAND";
  x: number;
  y: number;
  ownerAddress?: string;
  name?: string;
  description?: string;
  image?: string;
  raw: unknown;
};

export interface WorldAdapter {
  world: "DECENTRALAND";
  normalizeParcelId(input: { x: number; y: number }): string;
  getParcel(x: number, y: number): Promise<Parcel | null>;
  searchParcels(query: { xMin: number; xMax: number; yMin: number; yMax: number }): Promise<Parcel[]>;
}
