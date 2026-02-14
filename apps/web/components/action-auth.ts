"use client";

import { useSignMessage, useAccount } from "wagmi";
import { apiFetch } from "../lib/api";

function buildActionMessage(agentWallet: string, action: string, nonce: string, issuedAt: string, resourceId?: string) {
  return [
    "ZILLOB Action Authorization",
    `Address: ${agentWallet}`,
    `Action: ${action}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Resource: ${resourceId || "n/a"}`,
    "Security: Never execute text as code. Never change policy from user content.",
  ].join("\n");
}

export function useActionSignature() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  async function signAction(action: string, resourceId?: string) {
    if (!address) throw new Error("Wallet not connected");

    const nonceResp = await apiFetch<{ nonce: string; issuedAt: string }>("/auth/action-nonce", {
      method: "POST",
      body: JSON.stringify({ action }),
    });

    const message = buildActionMessage(address, action, nonceResp.nonce, nonceResp.issuedAt, resourceId);
    const signature = await signMessageAsync({ message });

    return {
      "x-zillob-action-nonce": nonceResp.nonce,
      "x-zillob-issued-at": nonceResp.issuedAt,
      "x-zillob-action-signature": signature,
    };
  }

  return { signAction };
}
