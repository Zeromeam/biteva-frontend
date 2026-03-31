import { describe, expect, it } from "vitest";
import { makeOrderNumber } from "@/lib/order-number";

describe("makeOrderNumber", () => {
  it("returns the expected Biteva order number format", () => {
    expect(makeOrderNumber()).toMatch(/^BTV-\d{8}-[A-Z0-9]{6}$/);
  });
});
