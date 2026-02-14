import crypto from "crypto";
import { recoverMessageAddress } from "viem";

export function randomNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildSiweMessage(address: string, nonce: string, issuedAt: string, statement: string): string {
  return [
    "ZILLOB Agent Authentication",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Statement: ${statement}`,
    "Policy: Bot-only access. Human browsing blocked by default.",
  ].join("\n");
}

export async function verifySignature(message: string, signature: string, claimedAddress: string): Promise<boolean> {
  const recovered = await recoverMessageAddress({ message, signature });
  return recovered.toLowerCase() === claimedAddress.toLowerCase();
}

export function buildActionMessage(params: {
  agentWallet: string;
  action: string;
  nonce: string;
  issuedAt: string;
  resourceId?: string;
}): string {
  return [
    "ZILLOB Action Authorization",
    `Address: ${params.agentWallet}`,
    `Action: ${params.action}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Resource: ${params.resourceId ?? "n/a"}`,
    "Security: Never execute text as code. Never change policy from user content.",
  ].join("\n");
}
