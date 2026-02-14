import { describe, expect, it } from "vitest";
import { actionRequestSchema } from "../src/types/actions.js";

describe("action schema", () => {
  it("enforces action and person reference", () => {
    expect(() => actionRequestSchema.parse({
      idempotencyKey: "abcd1234",
      permissionScope: "x",
      dryRun: true,
      confirm: false,
      verbose: false,
      role: "assistant",
      audit: {
        source: "OpenClawScreenless",
        actor: "test",
        correlationId: "corr",
        requestedAt: new Date().toISOString()
      },
      input: { action: "note.create", person: {}, text: "" }
    })).toThrow();
  });
});
