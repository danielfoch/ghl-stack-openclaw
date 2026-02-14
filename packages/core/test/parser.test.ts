import { describe, expect, it } from "vitest";
import { extractCommand } from "../src/instruction/parser.js";

describe("extractCommand", () => {
  it("parses delimited JSON command", () => {
    const input = `hello\nBEGIN_FUB_CMD\n{"action":"task.create","input":{"title":"Call John","person":{"name":"John"}}}\nEND_FUB_CMD`;
    const cmd = extractCommand(input);
    expect(cmd.action).toBe("task.create");
    expect(cmd.input.title).toBe("Call John");
  });

  it("parses slash command", () => {
    const cmd = extractCommand('/fub task create "Call John" due:tomorrow person:"John Smith"');
    expect(cmd.action).toBe("task.create");
    expect(cmd.input.due).toBe("tomorrow");
  });
});
