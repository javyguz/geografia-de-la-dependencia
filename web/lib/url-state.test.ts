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
    };
    expect(parseState(serializeState(state))).toEqual(state);
  });

  it("falls back to the defaults for an empty query", () => {
    expect(parseState("")).toEqual(emptyState());
    expect(emptyState().layer).toBe(DEFAULT_LAYER);
  });

  it("ignores a year that is not a number", () => {
    expect(parseState("?anio=abc").year).toBeNull();
  });
});
