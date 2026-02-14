import type { ActionName, Role } from "../types/actions.js";
import { PermissionError } from "../errors.js";

const allowlist: Record<Role, ActionName[]> = {
  readonly: ["person.find", "listing.search", "listing.get", "summary.generate", "voicemail.audio.list", "voicemail.campaign.status"],
  assistant: [
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
  ],
  automation: [
    "person.find",
    "person.upsert",
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
  ],
  operator: [
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
  ]
};

export function assertAllowed(role: Role, action: ActionName): void {
  if (!allowlist[role]?.includes(action)) {
    throw new PermissionError(`role ${role} cannot execute ${action}`);
  }
}
