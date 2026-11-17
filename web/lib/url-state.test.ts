import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYER,
  emptyState,
  parseState,
  serializeState,
} from "./url-state";

describe("url state", () => {
  it("writes nothing for the defaults", () => {
    expect(serializeState(emptyState())).toBe("");
  });

  it("round-trips a full state", () => {
    const state = {
      layer: "value_split",
      indicator: "labor_share",
      indicator2: null,
      sector: "31-33",
      year: 2018,
      territory: "08",
      mode: "compare" as const,
      compare: ["08037", "19039"],
      counterargument: true,
    };
    expect(parseState(serializeState(state))).toEqual(state);
  });

  it("falls back to the defaults for an empty query", () => {
    expect(parseState("")).toEqual(emptyState());
    expect(emptyState().layer).toBe(DEFAULT_LAYER);
  });

  it("keeps at most three valid, distinct territories to compare", () => {
    expect(parseState("?cmp=08,08,x1,19039,14,09").compare).toEqual([
      "08",
      "19039",
      "14",
    ]);
  });

  it("writes the compare list with plain commas", () => {
    const state = { ...emptyState(), compare: ["08", "19"] };
    expect(serializeState(state)).toBe("?cmp=08,19");
  });

  it("ignores a year that is not a number", () => {
    expect(parseState("?anio=abc").year).toBeNull();
  });
});
