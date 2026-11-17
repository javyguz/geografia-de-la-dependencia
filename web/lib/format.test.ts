import { describe, expect, it } from "vitest";
import { formatBare, formatValue } from "./format";

describe("formatValue", () => {
  it("shows percentages stored as proportions with one decimal", () => {
    expect(formatValue(0.1234, "percent", 1)).toBe("12.3 %");
  });

  it("keeps the decimal for whole percentages", () => {
    expect(formatValue(0.5, "percent", 1)).toBe("50.0 %");
  });

  it("groups thousands and names the unit", () => {
    expect(formatValue(23456.4, "usd", 0)).toBe("23,456 dólares");
  });

  it("leaves a count without a unit label", () => {
    expect(formatValue(12.34, "count", 1)).toBe("12.3");
  });
});

describe("formatBare", () => {
  it("omits the unit", () => {
    expect(formatBare(0.25, "percent", 0)).toBe("25");
  });
});
