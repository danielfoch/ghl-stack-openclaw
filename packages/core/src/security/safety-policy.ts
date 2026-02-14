import crypto from "node:crypto";
import type { AppConfig } from "../config.js";
import { ValidationError } from "../errors.js";
import type { ActionInput } from "../types/actions.js";

const SECRET_PATTERN = /(api[_-]?key|password|token|secret|bearer\s+[a-z0-9\-._~+/]+=*)/i;

export function hashContent(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function enforceSafety(input: ActionInput, config: AppConfig): void {
  if (input.action === "voicemail.drop") {
    if (!config.APP_ALLOW_NON_US_CA) {
      const invalid = input.phoneNumbers.find((phone) => !phone.startsWith("+1"));
      if (invalid) {
        throw new ValidationError(`destination outside allowed regions: ${invalid}`);
      }
    }
    return;
  }

  if (input.action !== "message.send") return;

  if (SECRET_PATTERN.test(input.body)) {
    throw new ValidationError("message blocked by safety policy: possible secret disclosure");
  }

  const hasDirective = /BEGIN_FUB_CMD|END_FUB_CMD|\/fub\s+/i.test(input.body);
  if (hasDirective) {
    throw new ValidationError("message body cannot contain command directives");
  }

  if (!config.APP_ALLOW_NON_US_CA && !input.to.startsWith("+1")) {
    throw new ValidationError("destination outside allowed regions");
  }

  if (input.to.includes(",")) {
    throw new ValidationError("mass messaging is blocked by default");
  }
}
