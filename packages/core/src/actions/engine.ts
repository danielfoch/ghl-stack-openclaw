import { actionRequestSchema, type ActionRequest, type ActionResult } from "../types/actions.js";
import type { AppConfig } from "../config.js";
import type { AppStore } from "../db/store.js";
import { assertAllowed } from "../security/permissions.js";
import { enforceSafety, hashContent } from "../security/safety-policy.js";
import { encryptText } from "../security/encryption.js";
import { AppError, ValidationError } from "../errors.js";
import type {
  EmailAdapter,
  FubAdapter,
  IdxAdapter,
  OutboundOnlyTransport,
  SmsAdapter,
  VoiceAdapter
} from "../types/adapters.js";
import { resolveOrUpsertPerson, resolvePerson, type PersonRef } from "./resolver.js";

export type EngineDeps = {
  config: AppConfig;
  store: AppStore;
  fub: FubAdapter;
  idx: IdxAdapter;
  sms: SmsAdapter;
  email?: EmailAdapter;
  voice?: VoiceAdapter;
  outboundOnly?: OutboundOnlyTransport;
  logger: {
    info(input: unknown, msg?: string): void;
    error(input: unknown, msg?: string): void;
  };
};

export class ActionEngine {
  constructor(private readonly deps: EngineDeps) {}

  async run(raw: ActionRequest): Promise<ActionResult> {
    const request = actionRequestSchema.parse(raw) as ActionRequest;
    const cached = this.deps.store.getIdempotentResult(request.idempotencyKey);
    if (cached) {
      return JSON.parse(cached) as ActionResult;
    }

    try {
      assertAllowed(request.role, request.input.action);
      enforceSafety(request.input, this.deps.config);

      const execute = request.confirm && !request.dryRun;
      const result = await this.execute(request, execute);
      this.deps.store.storeIdempotency(request.idempotencyKey, request.input.action, request.audit.correlationId, JSON.stringify(result));
      return result;
    } catch (error) {
      const appError = normalizeError(error);
      this.deps.logger.error({ err: appError, correlationId: request.audit.correlationId }, "action failed");
      return {
        ok: false,
        dryRun: request.dryRun,
        correlationId: request.audit.correlationId,
        action: request.input.action,
        redacted: !request.verbose,
        error: {
          code: appError.code,
          message: appError.message,
          retryable: appError.retryable
        }
      };
    }
  }

  private async execute(request: ActionRequest, execute: boolean): Promise<ActionResult> {
    const { input } = request;

    switch (input.action) {
      case "person.find": {
        const data = await this.deps.fub.searchPeople(input.query);
        return ok(request, data);
      }
      case "person.upsert": {
        assertPersonRef(input.person);
        if (!execute) return ok(request, { would: "person.upsert", person: input.person });
        const person = await resolveOrUpsertPerson(input.person, this.deps.fub, this.deps.store);
        return ok(request, person);
      }
      case "person.tag.add": {
        assertPersonRef(input.person);
        const person = await resolveOrUpsertPerson(input.person, this.deps.fub, this.deps.store);
        if (!execute) return ok(request, { would: "person.tag.add", personId: person.id, tag: input.tag });
        await this.deps.fub.addTag(person.id, input.tag);
        return ok(request, { personId: person.id, tag: input.tag });
      }
      case "person.tag.remove": {
        assertPersonRef(input.person);
        const person = await resolveOrUpsertPerson(input.person, this.deps.fub, this.deps.store);
        if (!execute) return ok(request, { would: "person.tag.remove", personId: person.id, tag: input.tag });
        await this.deps.fub.removeTag(person.id, input.tag);
        return ok(request, { personId: person.id, tag: input.tag });
      }
      case "note.create": {
        assertPersonRef(input.person);
        const person = await resolveOrUpsertPerson(input.person, this.deps.fub, this.deps.store);
        if (!execute) return ok(request, { would: "note.create", personId: person.id, text: input.text });
        const note = await this.deps.fub.createNote(person.id, input.text, withAudit(request));
        return ok(request, note);
      }
      case "task.create": {
        assertPersonRef(input.person);
        const person = await resolveOrUpsertPerson(input.person, this.deps.fub, this.deps.store);
        if (!execute) return ok(request, { would: "task.create", personId: person.id, title: input.title, dueAt: input.dueAt });
        const task = await this.deps.fub.createTask(person.id, input.title, input.dueAt, input.description, withAudit(request));
        return ok(request, task);
      }
      case "task.complete": {
        if (!execute) return ok(request, { would: "task.complete", taskId: input.taskId });
        await this.deps.fub.completeTask(input.taskId);
        return ok(request, { taskId: input.taskId, complete: true });
      }
      case "message.send": {
        if (!execute) return ok(request, { would: "message.send", channel: input.channel, to: input.to });

        const sent = await this.dispatchMessage(input.channel, {
          to: input.to,
          body: input.body,
          subject: input.subject,
          from: input.from
        });

        let personId: number | undefined;
        if (input.person) {
          const person = await resolvePerson(input.person, this.deps.fub, this.deps.store);
          personId = person?.id;
        }

        this.deps.store.storeMessageLog({
          idempotencyKey: request.idempotencyKey,
          correlationId: request.audit.correlationId,
          channel: input.channel,
          provider: sent.provider,
          providerMessageId: sent.providerMessageId,
          recipient: sent.to,
          bodyHash: hashContent(input.body),
          ...(personId ? { personId } : {}),
          sentAt: sent.sentAt,
          contentEncrypted: encryptText(input.body, this.deps.config.APP_ENCRYPTION_KEY)
        });

        if (input.logToFub && personId) {
          await this.logMessageToFub(input.channel, personId, input.body, input.subject, sent.to, sent.providerMessageId, request.audit.correlationId);
        }

        return ok(request, sent);
      }
      case "message.logToFUB": {
        assertPersonRef(input.person);
        const person = await resolveOrUpsertPerson(input.person, this.deps.fub, this.deps.store);
        if (!execute) return ok(request, { would: "message.logToFUB", personId: person.id, channel: input.channel });

        await this.logMessageToFub(
          input.channel,
          person.id,
          input.body,
          undefined,
          input.to,
          input.providerMessageId,
          request.audit.correlationId,
          input.sentAt ?? new Date().toISOString()
        );
        return ok(request, { personId: person.id, channel: input.channel });
      }
      case "listing.search": {
        const listings = await this.deps.idx.searchListings(input.query);
        return ok(request, listings);
      }
      case "listing.get": {
        const listing = input.mlsId
          ? await this.deps.idx.getListingByMlsId(input.mlsId)
          : await this.deps.idx.getListingByAddress(input.address!);
        return ok(request, listing);
      }
      case "summary.generate": {
        const summary = `Summary: ${input.topic} | keys: ${Object.keys(input.data ?? {}).join(", ")}`;
        return ok(request, { summary });
      }
      default:
        throw new ValidationError("unsupported action");
    }
  }

  private async dispatchMessage(channel: "sms" | "email" | "imessage" | "whatsapp" | "voice", message: { to: string; body: string; subject?: string; from?: string }) {
    switch (channel) {
      case "sms":
        return this.deps.sms.sendSMS(message);
      case "email":
        if (!this.deps.email) throw new ValidationError("email adapter not configured");
        return this.deps.email.sendEmail(message);
      case "voice":
        if (!this.deps.voice) throw new ValidationError("voice adapter not configured");
        return this.deps.voice.sendVoiceMessage(message);
      case "imessage":
      case "whatsapp":
        if (!this.deps.outboundOnly) throw new ValidationError("outbound-only adapter not configured");
        return this.deps.outboundOnly.send(channel, message);
      default:
        throw new ValidationError(`unsupported channel: ${String(channel)}`);
    }
  }

  private async logMessageToFub(
    channel: "sms" | "email" | "imessage" | "whatsapp" | "voice",
    personId: number,
    body: string,
    subject: string | undefined,
    to: string,
    providerMessageId: string | undefined,
    correlationId: string,
    sentAt = new Date().toISOString()
  ): Promise<void> {
    const meta = {
      ...withCorrelation(correlationId),
      providerMessageId: providerMessageId ?? "unknown"
    };

    if (channel === "sms" || channel === "imessage" || channel === "whatsapp") {
      await this.deps.fub.logText(personId, body, sentAt, to, meta);
      return;
    }

    if (channel === "email") {
      await this.deps.fub.logEmail(personId, subject, body, sentAt, to, meta);
      return;
    }

    await this.deps.fub.logCall(personId, body, sentAt, meta);
  }
}

function assertPersonRef(person: PersonRef): asserts person is PersonRef {
  if (!person.personId && !person.email && !person.phone && !person.name) {
    throw new ValidationError("person reference required");
  }
}

function ok(request: ActionRequest, data: unknown): ActionResult {
  return {
    ok: true,
    dryRun: request.dryRun,
    correlationId: request.audit.correlationId,
    action: request.input.action,
    redacted: !request.verbose,
    data: request.verbose ? data : redact(data)
  };
}

function redact(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(redact);
  if (!data || typeof data !== "object") return data;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (["body", "content", "emails", "phones", "customFields"].includes(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

function withAudit(request: ActionRequest): Record<string, string> {
  return {
    source: request.audit.source,
    correlationId: request.audit.correlationId
  };
}

function withCorrelation(correlationId: string): Record<string, string> {
  return {
    source: "OpenClawScreenless",
    correlationId
  };
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError("UNEXPECTED_ERROR", (error as Error)?.message ?? "unknown error", true, 500);
}
