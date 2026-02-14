"use client";

import { useState } from "react";
import { apiFetch, getCsrfToken } from "../../lib/api";
import { useActionSignature } from "../../components/action-auth";

export default function CreateListingPage() {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [priceWei, setPriceWei] = useState("100000000000000000");
  const [description, setDescription] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [status, setStatus] = useState("");
  const { signAction } = useActionSignature();

  const submit = async () => {
    try {
      const csrf = await getCsrfToken();
      const headers = await signAction("CREATE_LISTING", `${x},${y}`);
      await apiFetch("/listings", {
        method: "POST",
        headers: { ...headers, "x-csrf-token": csrf },
        body: JSON.stringify({
          world: "DECENTRALAND",
          x,
          y,
          priceWei,
          currency: "ETH",
          description,
          tags: ["openclaw", "metaverse"],
          durationHours,
        }),
      });
      setStatus("Listing created");
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Create Listing</h1>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded bg-slate-950 p-2" type="number" value={x} onChange={(e) => setX(Number(e.target.value))} placeholder="x" />
        <input className="rounded bg-slate-950 p-2" type="number" value={y} onChange={(e) => setY(Number(e.target.value))} placeholder="y" />
        <input className="rounded bg-slate-950 p-2" value={priceWei} onChange={(e) => setPriceWei(e.target.value)} placeholder="price wei" />
        <input className="rounded bg-slate-950 p-2" type="number" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} placeholder="duration hours" />
      </div>
      <textarea className="w-full rounded bg-slate-950 p-2" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" />
      <button className="rounded bg-emerald-600 px-4 py-2" onClick={submit}>Create</button>
      <p className="text-sm">{status}</p>
    </div>
  );
}
