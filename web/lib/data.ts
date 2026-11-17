import type { FeatureCollection } from "geojson";
import type { Catalog, Cell, Series, Territory, ValuesFile } from "./types";

export const NATIONAL = "00";

export interface StateData {
  catalog: Catalog;
  /** Territory records by key. The national row ("00") is included. */
  territories: Map<string, Territory>;
  values: ValuesFile;
  geometry: FeatureCollection;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/data/${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

export async function loadStateData(): Promise<StateData> {
  const [catalog, territories, values, geometry] = await Promise.all([
    getJson<Catalog>("catalog.json"),
    getJson<Territory[]>("territories.json"),
    getJson<ValuesFile>("values/states.json"),
    getJson<FeatureCollection>("geo/states.geojson"),
  ]);
  return {
    catalog,
    // Municipalities share the file but belong to the municipal level, which loads later.
    territories: new Map(
      territories.filter((t) => t.level === "state").map((t) => [t.id, t]),
    ),
    values,
    geometry,
  };
}

export function findSeries(
  file: ValuesFile,
  indicator: string,
  sector: string,
  year: number,
): Series | undefined {
  return file.series.find(
    (s) => s.indicator === indicator && s.sector === sector && s.year === year,
  );
}

/** Every territory's value for one series, keyed by territory. */
export function cellsOf(file: ValuesFile, series: Series): Map<string, Cell> {
  const reasons = new Map<number, Cell["reason"]>();
  for (const [reason, positions] of Object.entries(series.missing)) {
    for (const position of positions ?? []) {
      reasons.set(position, reason as Cell["reason"]);
    }
  }
  const cells = new Map<string, Cell>();
  file.territories.forEach((id, position) => {
    const value = series.values[position];
    if (value === null || value === undefined) {
      // The pipeline guarantees a reason for every null; "not_published" is the
      // honest fallback if a file ever breaks that rule.
      cells.set(id, {
        value: null,
        reason: reasons.get(position) ?? "not_published",
      });
    } else {
      cells.set(id, { value, reason: null });
    }
  });
  return cells;
}

/** Sectors that have a series for the indicator, in the order the catalog lists them. */
export function sectorsWithData(
  catalog: Catalog,
  file: ValuesFile,
  indicator: string,
  year: number,
) {
  const present = new Set(
    file.series
      .filter((s) => s.indicator === indicator && s.year === year)
      .map((s) => s.sector),
  );
  return catalog.sectors.filter((sector) => present.has(sector.id));
}
