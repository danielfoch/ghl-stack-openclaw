import { z } from "zod";
import { ValidationError } from "../errors.js";

const envelopeSchema = z.object({
  idempotencyKey: z.string().min(8).optional(),
  action: z.string(),
  input: z.record(z.string(), z.any())
});

export type ParsedInboundCommand = z.infer<typeof envelopeSchema>;

const begin = "BEGIN_FUB_CMD";
const end = "END_FUB_CMD";

export function extractCommand(message: string): ParsedInboundCommand {
  const jsonCommand = extractDelimited(message);
  if (jsonCommand) {
    return parseJsonEnvelope(jsonCommand);
  }

  const slash = extractSlashCommand(message);
  if (slash) {
    return slash;
  }

  throw new ValidationError("no executable command found");
}

function extractDelimited(message: string): string | null {
  const start = message.indexOf(begin);
  const finish = message.indexOf(end);
  if (start === -1 || finish === -1 || finish <= start) return null;
  return message.slice(start + begin.length, finish).trim();
}

function parseJsonEnvelope(body: string): ParsedInboundCommand {
  try {
    const parsed = JSON.parse(body);
    return envelopeSchema.parse(parsed);
  } catch (error) {
    throw new ValidationError(`invalid command JSON: ${(error as Error).message}`);
  }
}

function extractSlashCommand(message: string): ParsedInboundCommand | null {
  const line = message.split("\n").find((x) => x.trim().startsWith("/fub "));
  if (!line) return null;
  const tokens = tokenize(line.trim());
  if (tokens.length < 3) throw new ValidationError("slash command too short");

  const [, domain, verb, ...rest] = tokens;
  const action = `${domain}.${verb}`;
  const input: Record<string, unknown> = {};

  for (const token of rest) {
    const pair = token.split(":");
    if (pair.length === 2) {
      const [k, v] = pair;
      if (k && v !== undefined) input[k] = stripQuotes(v);
    } else {
      input.text = [String(input.text ?? ""), stripQuotes(token)].filter(Boolean).join(" ").trim();
    }
  }

  return { action, input };
}

function tokenize(input: string): string[] {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g);
  return (matches ?? []).map(stripQuotes);
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}
