import type { OutboundOnlyTransport, OutboundResult, VoiceAdapter } from "@fub/core";

export class ElevenLabsVoiceAdapter implements VoiceAdapter {
  constructor(private readonly opts: { apiKey: string; baseUrl: string }) {}

  async sendVoiceMessage(message: { to: string; body: string }): Promise<OutboundResult> {
    const response = await fetch(`${this.opts.baseUrl}/v1/calls`, {
      method: "POST",
      headers: {
        "xi-api-key": this.opts.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: message.to,
        script: message.body
      })
    });

    if (!response.ok) throw new Error(`ElevenLabs call failed: ${response.status}`);
    const data = (await response.json()) as { id?: string };

    return {
      providerMessageId: data.id ?? `eleven-${Date.now()}`,
      provider: "elevenlabs",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export class MockVoiceAdapter implements VoiceAdapter {
  async sendVoiceMessage(message: { to: string }): Promise<OutboundResult> {
    return {
      providerMessageId: `voice-mock-${Date.now()}`,
      provider: "voice-mock",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export class OpenClawOutboundOnlyTransport implements OutboundOnlyTransport {
  constructor(private readonly _opts: { endpoint: string; token: string }) {}

  async send(channel: "imessage" | "whatsapp", message: { to: string; body: string }): Promise<OutboundResult> {
    return {
      providerMessageId: `${channel}-skill-${Date.now()}`,
      provider: `openclaw-${channel}`,
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export class MockOutboundOnlyTransport implements OutboundOnlyTransport {
  async send(channel: "imessage" | "whatsapp", message: { to: string }): Promise<OutboundResult> {
    return {
      providerMessageId: `outbound-${channel}-${Date.now()}`,
      provider: `outbound-mock-${channel}`,
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}
