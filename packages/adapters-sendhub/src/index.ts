import crypto from "node:crypto";
import type { OutboundResult, SmsAdapter } from "@fub/core";

export class SendHubAdapter implements SmsAdapter {
  constructor(private readonly opts: { baseUrl: string; apiKey: string }) {}

  async sendSMS(message: { to: string; body: string; from?: string }): Promise<OutboundResult> {
    const response = await fetch(`${this.opts.baseUrl}/messages/sms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: message.to,
        text: message.body,
        from: message.from
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SendHub send failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { id?: string; messageId?: string };
    return {
      providerMessageId: data.messageId ?? data.id ?? `mock-${Date.now()}`,
      provider: "sendhub",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export function verifySendhubWebhook(signature: string | undefined, payloadRaw: string, secret: string): boolean {
  if (!signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(payloadRaw).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(digest);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export class MockSendHubAdapter implements SmsAdapter {
  async sendSMS(message: { to: string; body: string }): Promise<OutboundResult> {
    return {
      providerMessageId: `mock-sms-${Date.now()}`,
      provider: "sendhub-mock",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}
