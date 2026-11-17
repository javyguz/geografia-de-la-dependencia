import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareSections, pairCount } from "./compare";
import type { Data } from "./data";
import type { Catalog, ValuesFile } from "./types";

const DATA = join(__dirname, "..", "public", "data");
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(join(DATA, path), "utf-8")) as T;

const data: Data = {
  catalog: read<Catalog>("catalog.json"),
  territories: new Map(),
  states: read<ValuesFile>("values/states.json"),
  stateGeometry: { type: "FeatureCollection", features: [] },
  municipal: null,
};

describe("compareSections", () => {
  it("lists every indicator of the catalog exactly once", () => {
    const ids = compareSections(data).flatMap((s) =>
      s.indicators.map((i) => i.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(
      new Set(data.catalog.indicators.map((i) => i.id)),
    );
  });

  it("ends with the counterargument", () => {
    expect(compareSections(data).at(-1)?.title).toBe(
      data.catalog.counterargument.title,
    );
  });
});

describe("pairCount", () => {
  it("counts only the states with a value in both groups", () => {
    const count = pairCount(
      data,
      "wage_per_paid_worker_foreign",
      "wage_per_paid_worker_domestic",
      "total",
      2023,
    );
    expect(count.higher + count.lower + count.equal).toBe(count.of);
    expect(count.of).toBeLessThanOrEqual(32);
    // Figures of the committed data: 27 higher with foreign capital, 5 lower.
    expect(count).toMatchObject({ higher: 27, lower: 5 });
  });

  it("leaves out states where a sector is confidential", () => {
    const count = pairCount(
      data,
      "wage_per_paid_worker_foreign",
      "wage_per_paid_worker_domestic",
      "11",
      2023,
    );
    expect(count.of).toBeLessThan(32);
  });
});
