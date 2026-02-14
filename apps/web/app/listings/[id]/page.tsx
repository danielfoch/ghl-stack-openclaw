"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getCsrfToken } from "../../../lib/api";
import { useActionSignature } from "../../../components/action-auth";

type ListingDetail = {
  listing: {
    id: string;
    parcelId: string;
    priceWei: string;
    currency: string;
    description?: string;
    offers: Array<{ id: string; offerPriceWei: string; status: string }>;
  };
  history: Array<{ id: string; action: string; createdAt: string }>;
};

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ListingDetail | null>(null);
  const [offerWei, setOfferWei] = useState("");
  const [txHash, setTxHash] = useState("0x".padEnd(66, "0"));
  const [error, setError] = useState("");
  const { signAction } = useActionSignature();

  const load = async () => {
    try {
      const out = await apiFetch<ListingDetail>(`/listings/${params.id}`);
      setData(out);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const makeOffer = async () => {
    if (!data) return;
    try {
      const csrf = await getCsrfToken();
      const headers = await signAction("CREATE_OFFER", data.listing.id);
      await apiFetch("/listings/offers", {
        method: "POST",
        headers: { ...headers, "x-csrf-token": csrf },
        body: JSON.stringify({ listingId: data.listing.id, offerPriceWei: offerWei }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const accept = async (offerId: string) => {
    try {
      const csrf = await getCsrfToken();
      const headers = await signAction("ACCEPT_OFFER", offerId);
      await apiFetch("/listings/offers/accept", {
        method: "POST",
        headers: { ...headers, "x-csrf-token": csrf },
        body: JSON.stringify({ offerId, txHash, chainId: 11155111 }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!data) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Parcel {data.listing.parcelId}</h1>
      <p>{data.listing.description || "No description"}</p>
      <p>Buy now: {data.listing.priceWei} wei ({data.listing.currency})</p>

      <section className="space-y-2 rounded border border-slate-700 bg-slate-900/70 p-4">
        <h2 className="text-xl font-semibold">Make Offer</h2>
        <input className="w-full rounded bg-slate-950 p-2" value={offerWei} onChange={(e) => setOfferWei(e.target.value)} placeholder="Offer wei" />
        <button className="rounded bg-emerald-600 px-3 py-2" onClick={makeOffer}>Submit Offer</button>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Offers</h2>
        <input className="w-full rounded bg-slate-950 p-2" value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="Escrow tx hash" />
        {data.listing.offers.map((offer) => (
          <div key={offer.id} className="flex items-center justify-between rounded border border-slate-700 p-3">
            <p>{offer.offerPriceWei} wei ({offer.status})</p>
            {offer.status === "PENDING" && <button className="rounded bg-emerald-600 px-3 py-1" onClick={() => accept(offer.id)}>Accept</button>}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">History</h2>
        {data.history.map((entry) => <p key={entry.id} className="text-sm text-slate-300">{entry.action} at {entry.createdAt}</p>)}
      </section>
      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}
