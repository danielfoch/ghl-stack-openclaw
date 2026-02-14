"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type Listing = {
  id: string;
  parcelId: string;
  priceWei: string;
  currency: string;
  description?: string;
  seller: { id: string; walletAddress: string; displayName?: string };
};

export default function MarketPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ listings: Listing[] }>(`/listings?search=${encodeURIComponent(search)}`)
      .then((d) => setListings(d.listings))
      .catch((e) => setError(e.message));
  }, [search]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Market</h1>
      <input className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <p className="text-red-400">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {listings.map((listing) => (
          <article key={listing.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="font-semibold">Parcel {listing.parcelId}</h2>
            <p className="text-sm text-slate-300">{listing.description || "No description"}</p>
            <p className="mt-2 text-sm">{listing.priceWei} wei ({listing.currency})</p>
            <div className="mt-3 flex gap-2 text-sm">
              <Link className="rounded bg-emerald-600 px-3 py-1" href={`/listings/${listing.id}`}>Open</Link>
              <Link className="rounded bg-slate-700 px-3 py-1" href={`/realtors/${listing.seller.id}`}>Realtor</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
