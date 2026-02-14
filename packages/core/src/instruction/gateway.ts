import { v4 as uuidv4 } from "uuid";
import { authenticateInbound, type InboundSource } from "../security/inbound-auth.js";
import { extractCommand } from "./parser.js";
import { ValidationError } from "../errors.js";
import type { AppConfig } from "../config.js";

export type InboundEnvelope = {
  source: InboundSource;
  body: string;
  transport: "email" | "sms" | "voice";
  receivedAt: string;
};

export function extractActionFromInbound(envelope: InboundEnvelope, config: AppConfig) {
  if (!authenticateInbound(envelope.source, config)) {
    throw new ValidationError("unauthorized inbound sender");
  }

  const cmd = extractCommand(envelope.body);
  return {
    idempotencyKey: cmd.idempotencyKey ?? uuidv4(),
    action: cmd.action,
    input: cmd.input,
    rawBody: envelope.body
  };
}
