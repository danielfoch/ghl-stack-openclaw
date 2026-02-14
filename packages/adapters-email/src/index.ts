import { execFile } from "node:child_process";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import type { AppConfig, EmailAdapter, OutboundResult } from "@fub/core";

const execFileAsync = promisify(execFile);

export class SmtpEmailAdapter implements EmailAdapter {
  private readonly transporter;

  constructor(private readonly cfg: AppConfig) {
    this.transporter = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT,
      secure: cfg.SMTP_SECURE,
      auth: cfg.SMTP_USER ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS } : undefined
    });
  }

  async sendEmail(message: { to: string; body: string; subject?: string; from?: string }): Promise<OutboundResult> {
    const result = await this.transporter.sendMail({
      to: message.to,
      from: message.from ?? this.cfg.SMTP_FROM,
      subject: message.subject ?? "",
      text: message.body
    });

    return {
      providerMessageId: result.messageId,
      provider: "smtp",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export class SendGridEmailAdapter implements EmailAdapter {
  constructor(private readonly apiKey: string) {}

  async sendEmail(message: { to: string; body: string; subject?: string; from?: string }): Promise<OutboundResult> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: message.from ?? "assistant@example.com" },
        subject: message.subject ?? "",
        content: [{ type: "text/plain", value: message.body }]
      })
    });

    if (!response.ok) throw new Error(`SendGrid send failed: ${response.status}`);

    return {
      providerMessageId: response.headers.get("x-message-id") ?? `sendgrid-${Date.now()}`,
      provider: "sendgrid",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export class MailgunEmailAdapter implements EmailAdapter {
  constructor(private readonly apiKey: string, private readonly domain: string) {}

  async sendEmail(message: { to: string; body: string; subject?: string; from?: string }): Promise<OutboundResult> {
    const form = new URLSearchParams({
      from: message.from ?? `assistant@${this.domain}`,
      to: message.to,
      subject: message.subject ?? "",
      text: message.body
    });

    const response = await fetch(`https://api.mailgun.net/v3/${this.domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${this.apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    if (!response.ok) throw new Error(`Mailgun send failed: ${response.status}`);
    return {
      providerMessageId: `mailgun-${Date.now()}`,
      provider: "mailgun",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export class GogCliEmailAdapter implements EmailAdapter {
  constructor(private readonly commandPath: string) {}

  async sendEmail(message: { to: string; body: string; subject?: string; from?: string }): Promise<OutboundResult> {
    await execFileAsync(this.commandPath, ["send", "--to", message.to, "--subject", message.subject ?? "", "--body", message.body], {
      timeout: 15000,
      windowsHide: true
    });

    return {
      providerMessageId: `gog-${Date.now()}`,
      provider: "gog",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export class GmailApiAdapter implements EmailAdapter {
  constructor(private readonly cfg: AppConfig) {}

  async sendEmail(message: { to: string; body: string; subject?: string; from?: string }): Promise<OutboundResult> {
    if (!this.cfg.GMAIL_REFRESH_TOKEN) throw new Error("Gmail refresh token missing");
    return {
      providerMessageId: `gmail-${Date.now()}`,
      provider: "gmail",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export class MockEmailAdapter implements EmailAdapter {
  async sendEmail(message: { to: string; body: string }): Promise<OutboundResult> {
    return {
      providerMessageId: `mock-email-${Date.now()}`,
      provider: "email-mock",
      sentAt: new Date().toISOString(),
      to: message.to
    };
  }
}

export function createEmailAdapter(cfg: AppConfig): EmailAdapter {
  switch (cfg.EMAIL_PROVIDER) {
    case "smtp":
      return new SmtpEmailAdapter(cfg);
    case "sendgrid":
      if (!cfg.SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY required");
      return new SendGridEmailAdapter(cfg.SENDGRID_API_KEY);
    case "mailgun":
      if (!cfg.MAILGUN_API_KEY || !cfg.MAILGUN_DOMAIN) throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN required");
      return new MailgunEmailAdapter(cfg.MAILGUN_API_KEY, cfg.MAILGUN_DOMAIN);
    case "gog":
      return new GogCliEmailAdapter(cfg.GOG_CLI_PATH);
    case "gmail":
      return new GmailApiAdapter(cfg);
    default:
      return new SmtpEmailAdapter(cfg);
  }
}
