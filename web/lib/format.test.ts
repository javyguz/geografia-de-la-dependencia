import { describe, expect, it } from "vitest";
import { formatPercent } from "./format";

describe("formatPercent", () => {
  it("shows one decimal", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
  });

  it("keeps the decimal for whole percentages", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
  });
});
