import crypto from "node:crypto";
import { csv, type AppConfig } from "../config.js";

export type InboundSource = {
  fromEmail?: string;
  fromPhone?: string;
  signature?: string;
  providedSecret?: string;
};

function secureEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function authenticateInbound(source: InboundSource, config: AppConfig): boolean {
  const allowedEmails = new Set(csv(config.APP_ALLOWED_INBOUND_EMAILS).map((e) => e.toLowerCase()));
  const allowedPhones = new Set(csv(config.APP_ALLOWED_INBOUND_PHONES));

  const emailOk = source.fromEmail ? allowedEmails.has(source.fromEmail.toLowerCase()) : true;
  const phoneOk = source.fromPhone ? allowedPhones.has(source.fromPhone) : true;

  if (!emailOk || !phoneOk) return false;

  if (source.providedSecret) {
    return secureEqual(source.providedSecret, config.APP_WEBHOOK_SHARED_SECRET);
  }

  return true;
}
