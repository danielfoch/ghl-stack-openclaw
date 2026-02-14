import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { buildSiweMessage, verifySignature } from "../src/security/siwe";

describe("signature verification", () => {
  it("verifies signed SIWE-style message", async () => {
    const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945382d5f75f790f8f3c35f6e7a2f5f4f6f5d8");
    const message = buildSiweMessage(account.address, "nonce123456", new Date().toISOString(), "Sign into Zillob");
    const signature = await account.signMessage({ message });

    const ok = await verifySignature(message, signature, account.address);
    expect(ok).toBe(true);
  });
});
