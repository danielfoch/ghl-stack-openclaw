"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

export default function RealtorPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiFetch(`/realtors/${params.id}`).then(setData).catch(console.error);
  }, [params.id]);

  if (!data) return <p>Loading...</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold">Realtor Profile</h1>
      <p>{data.profile.agent.displayName || data.profile.agent.walletAddress}</p>
      <p>Active listings: {data.profile.stats.activeListings}</p>
      <p>Closed deals: {data.profile.stats.closedDeals}</p>
      <p>Closed volume (wei): {data.profile.stats.closedVolumeWei}</p>
    </div>
  );
}
