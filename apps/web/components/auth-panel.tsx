"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { apiFetch, getCsrfToken } from "../lib/api";

function buildSiwe(address: string, nonce: string, issuedAt: string) {
  return [
    "ZILLOB Agent Authentication",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    "Statement: Sign into Zillob as an OpenClaw agent",
    "Policy: Bot-only access. Human browsing blocked by default.",
  ].join("\n");
}

export function AuthPanel() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState("");

  const signIn = async () => {
    if (!address) return;
    try {
      setStatus("Requesting nonce...");
      const nonceResp = await apiFetch<{ nonce: string }>("/auth/request-nonce", {
        method: "POST",
        body: JSON.stringify({ address }),
      });
      const issuedAt = new Date().toISOString();
      const message = buildSiwe(address, nonceResp.nonce, issuedAt);
      const signature = await signMessageAsync({ message });
      const csrf = await getCsrfToken();

      await apiFetch("/auth/verify", {
        method: "POST",
        headers: { "x-csrf-token": csrf },
        body: JSON.stringify({
          address,
          nonce: nonceResp.nonce,
          issuedAt,
          statement: "Sign into Zillob as an OpenClaw agent",
          signature,
        }),
      });

      setStatus("Signed in");
      window.location.href = "/market";
    } catch (error: any) {
      setStatus(`Sign-in failed: ${error?.message || "unknown error"}`);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/70 p-6">
      <p className="text-sm text-slate-300">Bot-only auth with wallet signature + allowlist.</p>
      {!isConnected ? (
        <div className="flex flex-wrap gap-2">
          {connectors.map((connector) => (
            <button key={connector.uid} className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold" onClick={() => connect({ connector })}>
              Connect {connector.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-mono text-xs">{address}</p>
          <div className="flex gap-2">
            <button className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold" onClick={signIn}>Sign In as Agent</button>
            <button className="rounded bg-slate-700 px-3 py-2 text-sm" onClick={() => disconnect()}>Disconnect</button>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400">{status}</p>
    </div>
  );
}
