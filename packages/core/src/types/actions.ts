import { z } from "zod";

export const channelSchema = z.enum(["sms", "email", "imessage", "whatsapp", "voice"]);

export const actionNameSchema = z.enum([
  "person.find",
  "person.upsert",
  "person.tag.add",
  "person.tag.remove",
  "note.create",
  "task.create",
  "task.complete",
  "message.send",
  "message.logToFUB",
  "voicemail.drop",
  "voicemail.audio.list",
  "voicemail.campaign.status",
  "listing.search",
  "listing.get",
  "summary.generate"
]);

const auditSchema = z.object({
  source: z.string().default("OpenClawScreenless"),
  correlationId: z.string(),
  actor: z.string().default("system"),
  requestedAt: z.string().datetime()
});

const personRefSchema = z.object({
  personId: z.number().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).optional(),
  name: z.string().min(1).optional()
});

const personFind = z.object({ action: z.literal("person.find"), query: z.string().min(1) });
const personUpsert = z.object({ action: z.literal("person.upsert"), person: personRefSchema.extend({ tags: z.array(z.string()).optional(), stage: z.string().optional(), customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional() }) });
const personTagAdd = z.object({ action: z.literal("person.tag.add"), person: personRefSchema, tag: z.string().min(1) });
const personTagRemove = z.object({ action: z.literal("person.tag.remove"), person: personRefSchema, tag: z.string().min(1) });
const noteCreate = z.object({ action: z.literal("note.create"), person: personRefSchema, text: z.string().min(1) });
const taskCreate = z.object({ action: z.literal("task.create"), person: personRefSchema, title: z.string().min(1), dueAt: z.string().optional(), description: z.string().optional() });
const taskComplete = z.object({ action: z.literal("task.complete"), taskId: z.number() });
const messageSend = z.object({ action: z.literal("message.send"), channel: channelSchema, to: z.string().min(3), body: z.string().min(1), subject: z.string().optional(), from: z.string().optional(), person: personRefSchema.optional(), logToFub: z.boolean().default(true) });
const messageLog = z.object({ action: z.literal("message.logToFUB"), channel: channelSchema, to: z.string(), body: z.string(), person: personRefSchema, providerMessageId: z.string().optional(), sentAt: z.string().datetime().optional() });
const voicemailDrop = z.object({
  action: z.literal("voicemail.drop"),
  phoneNumbers: z.array(z.string().min(5)).min(1),
  audio: z.object({
    audioUrl: z.string().url().optional(),
    slyAudioName: z.string().min(1).optional()
  }).refine((v) => Boolean(v.audioUrl || v.slyAudioName), "audioUrl or slyAudioName required"),
  campaignName: z.string().optional(),
  callerId: z.string().optional(),
  sendDate: z.string().optional(),
  sendTime: z.string().optional(),
  timezone: z.string().optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).optional()
});
const voicemailAudioList = z.object({
  action: z.literal("voicemail.audio.list")
});
const voicemailCampaignStatus = z.object({
  action: z.literal("voicemail.campaign.status"),
  campaignId: z.string().min(1)
});
const listingSearch = z.object({ action: z.literal("listing.search"), query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) });
const listingGet = z.object({ action: z.literal("listing.get"), mlsId: z.string().optional(), address: z.string().optional() }).refine((v) => Boolean(v.mlsId || v.address), "mlsId or address required");
const summaryGenerate = z.object({ action: z.literal("summary.generate"), topic: z.string(), data: z.any() });

export const actionInputSchema = z.union([
  personFind,
  personUpsert,
  personTagAdd,
  personTagRemove,
  noteCreate,
  taskCreate,
  taskComplete,
  messageSend,
  messageLog,
  voicemailDrop,
  voicemailAudioList,
  voicemailCampaignStatus,
  listingSearch,
  listingGet,
  summaryGenerate
]);

export const roleSchema = z.enum(["operator", "assistant", "automation", "readonly"]);

export const actionRequestSchema = z.object({
  idempotencyKey: z.string().min(8),
  permissionScope: z.string().min(1),
  dryRun: z.boolean().default(true),
  confirm: z.boolean().default(false),
  verbose: z.boolean().default(false),
  role: roleSchema.default("assistant"),
  audit: auditSchema,
  input: actionInputSchema
});

export type ActionRequest = z.infer<typeof actionRequestSchema>;
export type ActionInput = z.infer<typeof actionInputSchema>;
export type ActionName = z.infer<typeof actionNameSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type Role = z.infer<typeof roleSchema>;

export type ActionResult<T = unknown> = {
  ok: boolean;
  dryRun: boolean;
  correlationId: string;
  action: ActionName;
  redacted: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
