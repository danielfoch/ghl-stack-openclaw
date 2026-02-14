import { describe, expect, it } from "vitest";
import { canUpdateListingPrice } from "../src/test-utils/listingsPermissions";

describe("listing permissions", () => {
  it("only allows seller to update listing price", () => {
    expect(canUpdateListingPrice({ sellerAgentId: "a1", actorAgentId: "a1" })).toBe(true);
    expect(canUpdateListingPrice({ sellerAgentId: "a1", actorAgentId: "a2" })).toBe(false);
  });
});
