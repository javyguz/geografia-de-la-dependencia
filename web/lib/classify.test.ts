import { describe, expect, it } from "vitest";
import { bivariateIndex, classIndex, quantileBreaks, spread } from "./classify";

describe("quantileBreaks", () => {
  it("splits ten values into five classes of two", () => {
    const breaks = quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(breaks).toHaveLength(4);
    const counts = [0, 0, 0, 0, 0];
    for (const v of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      counts[classIndex(v, breaks)] = (counts[classIndex(v, breaks)] ?? 0) + 1;
    expect(counts).toEqual([2, 2, 2, 2, 2]);
  });

  it("returns no breaks without values", () => {
    expect(quantileBreaks([], 5)).toEqual([]);
  });

  it("merges repeated thresholds when many values tie", () => {
    const breaks = quantileBreaks([0, 0, 0, 0, 0, 0, 0, 0, 5, 40], 5);
    expect(new Set(breaks).size).toBe(breaks.length);
    // The tied zeros stay together in the lowest class.
    expect(classIndex(0, breaks)).toBe(0);
    expect(classIndex(40, breaks)).toBe(breaks.length);
  });

  it("ignores input order", () => {
    expect(quantileBreaks([3, 1, 2], 3)).toEqual(quantileBreaks([1, 2, 3], 3));
  });
});

describe("classIndex", () => {
  it("keeps a value equal to a threshold in the lower class", () => {
    expect(classIndex(5, [5, 10])).toBe(0);
    expect(classIndex(5.1, [5, 10])).toBe(1);
  });

  it("covers the extremes", () => {
    expect(classIndex(-100, [5, 10])).toBe(0);
    expect(classIndex(100, [5, 10])).toBe(2);
  });
});

describe("bivariateIndex", () => {
  const columnBreaks = [10, 20];
  const rowBreaks = [10, 20];

  it("returns null when either axis is missing", () => {
    expect(bivariateIndex(null, 5, columnBreaks, rowBreaks, true)).toBeNull();
    expect(bivariateIndex(5, null, columnBreaks, rowBreaks, true)).toBeNull();
  });

  it("keeps the row as is when higher is better", () => {
    expect(bivariateIndex(25, 25, columnBreaks, rowBreaks, true)).toEqual({
      column: 2,
      row: 2,
    });
  });

  it("flips the row when higher is worse, so that high always means better conditions", () => {
    expect(bivariateIndex(25, 25, columnBreaks, rowBreaks, false)).toEqual({
      column: 2,
      row: 0,
    });
    expect(bivariateIndex(5, 5, columnBreaks, rowBreaks, false)).toEqual({
      column: 0,
      row: 2,
    });
  });
});

describe("spread", () => {
  it("uses the whole palette when every class is present", () => {
    expect([0, 1, 2, 3, 4].map((i) => spread(i, 5, 5))).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it("keeps the extremes when classes were merged", () => {
    expect([0, 1, 2].map((i) => spread(i, 3, 5))).toEqual([0, 2, 4]);
  });

  it("picks the middle colour for a single class", () => {
    expect(spread(0, 1, 5)).toBe(2);
  });
});
