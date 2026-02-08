import test from "node:test";
import assert from "node:assert/strict";
import { parseOrderBy, PROPERTY_SAFE_SUMMARY_FIELDS } from "./policy.js";

test("parseOrderBy allows allowlisted fields", () => {
  const r = parseOrderBy("ListPrice desc", PROPERTY_SAFE_SUMMARY_FIELDS);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value, "ListPrice desc");
});

test("parseOrderBy rejects non-allowlisted fields", () => {
  const r = parseOrderBy("PrivateNotes asc", PROPERTY_SAFE_SUMMARY_FIELDS);
  assert.equal(r.ok, false);
});

