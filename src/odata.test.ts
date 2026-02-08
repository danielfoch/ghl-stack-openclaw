import test from "node:test";
import assert from "node:assert/strict";
import { escODataString, toODataDateTimeOffsetLiteral, toPropertyFilter } from "./odata.js";

test("escODataString doubles single quotes", () => {
  assert.equal(escODataString("O'Reilly"), "O''Reilly");
});

test("toODataDateTimeOffsetLiteral normalizes to ISO", () => {
  const out = toODataDateTimeOffsetLiteral("2024-01-02T03:04:05Z");
  assert.equal(out, "2024-01-02T03:04:05.000Z");
});

test("toPropertyFilter rejects injection via updatedSince by normalizing", () => {
  const f = toPropertyFilter({ updatedSince: "2024-01-02T03:04:05Z" });
  assert.equal(f, "ModificationTimestamp ge 2024-01-02T03:04:05.000Z");
});

