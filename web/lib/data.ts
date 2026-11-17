import type { FeatureCollection } from "geojson";
import type { Catalog, Cell, Series, Territory, ValuesFile } from "./types";

export const NATIONAL = "00";

export type Level = Territory["level"];

/** Municipal data loads only when the map needs it; the sector files, one at a time. */
export interface MunicipalData {
  geometry: FeatureCollection;
  total: ValuesFile;
  sectors: Map<string, ValuesFile>;
}

export interface Data {
  catalog: Catalog;
  /** Every territory by key, both levels and the national row ("00"). */
  territories: Map<string, Territory>;
  states: ValuesFile;
  /** Null until it loads; the figures do not need it. */
  stateGeometry: FeatureCollection | null;
  municipal: MunicipalData | null;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/data/${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

/** What the first view needs, read at build time and written into the page (app/page.tsx). */
export interface Initial {
  catalog: Catalog;
  /** The national row and the 32 states; municipalities arrive with `loadRest`. */
  territories: Territory[];
  states: ValuesFile;
}

export function initialData(initial: Initial): Data {
  return {
    catalog: initial.catalog,
    territories: new Map(initial.territories.map((t) => [t.id, t])),
    states: initial.states,
    stateGeometry: null,
    municipal: null,
  };
}

/** Fetched after the page shows its figures. The page asks for them with its HTML. */
export const LATER_FILES = ["territories.json", "geo/states.geojson"] as const;

export async function loadRest(): Promise<{
  territories: Territory[];
  stateGeometry: FeatureCollection;
}> {
  const [territories, stateGeometry] = await Promise.all([
    getJson<Territory[]>(LATER_FILES[0]),
    getJson<FeatureCollection>(LATER_FILES[1]),
  ]);
  return { territories, stateGeometry };
}

export async function loadMunicipalities(): Promise<MunicipalData> {
  const [geometry, total] = await Promise.all([
    getJson<FeatureCollection>("geo/municipalities.geojson"),
    getJson<ValuesFile>("values/municipalities.json"),
  ]);
  return { geometry, total, sectors: new Map() };
}

export function loadMunicipalSector(sector: string): Promise<ValuesFile> {
  return getJson<ValuesFile>(`values/municipalities-sectors/${sector}.json`);
}

/** CVEGEO has 2 digits for a state and 5 for a municipality. */
export function levelOf(territory: string): Level {
  return territory.length === 5 ? "municipality" : "state";
}

export function stateOf(territory: string): string {
  return territory.slice(0, 2);
}

/** The file that holds a level and sector, or null while it has not loaded. */
export function valuesOf(
  data: Data,
  level: Level,
  sector: string,
): ValuesFile | null {
  if (level === "state") return data.states;
  if (!data.municipal) return null;
  return sector === "total"
    ? data.municipal.total
    : (data.municipal.sectors.get(sector) ?? null);
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
