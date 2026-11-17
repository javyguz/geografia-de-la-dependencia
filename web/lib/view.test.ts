import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { StateData } from "./data";
import { paletteFor } from "./palettes";
import type { Catalog, Territory, ValuesFile } from "./types";
import { emptyState } from "./url-state";
import { indicatorById, paintFor, resolve, sourcesOf } from "./view";

// These tests read the committed artifacts, the same files the app loads.
const DATA = join(__dirname, "..", "public", "data");
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(join(DATA, path), "utf-8")) as T;

const data: StateData = {
  catalog: read<Catalog>("catalog.json"),
  territories: new Map(
    read<Territory[]>("territories.json")
      .filter((t) => t.level === "state")
      .map((t) => [t.id, t]),
  ),
  values: read<ValuesFile>("values/states.json"),
  geometry: { type: "FeatureCollection", features: [] },
};
const light = paletteFor("light");

describe("resolve", () => {
  it("falls back to the first indicator of the layer and its latest year", () => {
    const resolved = resolve(data, {
      ...emptyState(),
      layer: "value_split",
      indicator: "nope",
    });
    expect(resolved.indicator.id).toBe("labor_share");
    expect(resolved.year).toBe(2023);
  });

  it("ignores a year the indicator does not have", () => {
    const resolved = resolve(data, {
      ...emptyState(),
      layer: "employment",
      indicator: "immex_employment_share",
      year: 2018,
    });
    expect(resolved.year).toBe(2023);
  });

  it("forces the total for an indicator without a sector breakdown", () => {
    const resolved = resolve(data, {
      ...emptyState(),
      layer: "employment",
      indicator: "immex_employment_share",
      sector: "31-33",
    });
    expect(resolved.sector).toBe("total");
  });

  it("gives the bivariate layer both axes", () => {
    const resolved = resolve(data, { ...emptyState(), layer: "spillover" });
    expect(resolved.indicator2?.id).toBe("informality_rate");
  });
});

describe("paintFor", () => {
  it("paints every entity of the default map and none as missing", () => {
    const paint = paintFor(data, resolve(data, emptyState()), light);
    expect(paint.fills.size).toBe(32);
    expect(paint.missing.size).toBe(0);
  });

  it("keeps the national row out of the map", () => {
    const paint = paintFor(data, resolve(data, emptyState()), light);
    expect(paint.fills.has("00")).toBe(false);
  });

  it("marks confidential entities as missing instead of painting them", () => {
    const resolved = resolve(data, { ...emptyState(), sector: "11" });
    const paint = paintFor(data, resolved, light);
    expect(paint.missing.size).toBeGreaterThan(0);
    for (const id of paint.missing.keys())
      expect(paint.fills.has(id)).toBe(false);
    expect(paint.fills.size + paint.missing.size).toBe(32);
  });

  it("does not paint a zero with the darkest colour when most values are zero", () => {
    // In the fishing sector most entities have no foreign capital at all.
    const resolved = resolve(data, { ...emptyState(), sector: "11" });
    const paint = paintFor(data, resolved, light);
    const zeros = [...paint.cells].filter(
      ([id, c]) => id !== "00" && c.value === 0,
    );
    expect(zeros.length).toBeGreaterThan(1);
    for (const [id] of zeros)
      expect(paint.fills.get(id)).toBe(light.sequential[0]);
  });

  it("puts the entity with the lowest informality in the high-conditions row", () => {
    const resolved = resolve(data, { ...emptyState(), layer: "spillover" });
    const paint = paintFor(data, resolved, light);
    const cells2 = paint.cells2;
    expect(cells2).not.toBeNull();
    const lowest = [...(cells2 ?? [])]
      .filter(([id, c]) => id !== "00" && c.value !== null)
      .sort((a, b) => (a[1].value ?? 0) - (b[1].value ?? 0))[0];
    const fill = paint.fills.get(lowest?.[0] ?? "");
    // Rows 2 of the bivariate palette are the high-conditions ones.
    expect(light.bivariate[2]).toContain(fill);
  });
});

describe("sourcesOf", () => {
  it("lists only the census of the year on screen", () => {
    const labor = indicatorById(data, "labor_share");
    if (!labor) throw new Error("labor_share missing from the catalog");
    expect(sourcesOf(data, [labor], 2023).map((s) => s.id)).toEqual(["ce2024"]);
    expect(sourcesOf(data, [labor], 2018).map((s) => s.id)).toEqual(["ce2019"]);
  });
});
