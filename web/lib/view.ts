/**
 * Turns the explorer state into what the map paints: which series, which colour
 * each territory gets and what the legend says. No map or React code here.
 */

import { bivariateIndex, classIndex, quantileBreaks, spread } from "./classify";
import {
  cellsOf,
  type Data,
  findSeries,
  type Level,
  levelOf,
  NATIONAL,
  stateOf,
  valuesOf,
} from "./data";
import { formatValue } from "./format";
import type { Palette } from "./palettes";
import { valuesWithoutNational } from "./ranking";
import type { Cell, Indicator, Layer, MissingReason, Source } from "./types";
import type { ViewState } from "./url-state";

export const CLASSES = 5;
export const BIVARIATE_CLASSES = 3;
/** Sector and year are fixed in the bivariate layer: its axes come from different sources. */
export const BIVARIATE_YEAR = 2023;

export interface Resolved {
  layer: Layer;
  /** Indicator coloured on the map; the integration axis in the bivariate layer. */
  indicator: Indicator;
  /** Conditions axis of the bivariate layer. */
  indicator2: Indicator | null;
  sector: string;
  year: number;
}

export interface MapPaint {
  /** Fill colour by territory; territories without a value are absent. */
  fills: Map<string, string>;
  missing: Map<string, MissingReason>;
  breaks: number[];
  breaks2: number[];
  cells: Map<string, Cell>;
  cells2: Map<string, Cell> | null;
}

export function layerById(data: Data, id: string): Layer {
  return (
    data.catalog.layers.find((l) => l.id === id) ??
    (data.catalog.layers[0] as Layer)
  );
}

export function indicatorById(data: Data, id: string): Indicator | undefined {
  return data.catalog.indicators.find((i) => i.id === id);
}

export function isBivariate(layer: Layer): boolean {
  return layer.integration !== undefined;
}

function firstOf(
  ids: string[] | undefined,
  wanted: string | null,
): string | undefined {
  return wanted && ids?.includes(wanted) ? wanted : ids?.[0];
}

/** Applies the rules that keep a state valid: the indicator belongs to the layer, the year to the indicator. */
export function resolve(data: Data, state: ViewState): Resolved {
  const layer = layerById(data, state.layer);
  const bivariate = isBivariate(layer);
  const indicatorId = firstOf(
    bivariate ? layer.integration : layer.indicators,
    state.indicator,
  );
  const indicator = indicatorById(data, indicatorId ?? "") as Indicator;
  const second = bivariate
    ? (indicatorById(data, firstOf(layer.conditions, state.indicator2) ?? "") ??
      null)
    : null;

  const year = bivariate
    ? BIVARIATE_YEAR
    : state.year !== null && indicator.years.includes(state.year)
      ? state.year
      : Math.max(...indicator.years);
  const sector = !bivariate && indicator.by_sector ? state.sector : "total";
  return { layer, indicator, indicator2: second, sector, year };
}

/** One series as cells, or null while its file has not loaded. A missing series gives no cells. */
export function cellsFor(
  data: Data,
  level: Level,
  indicator: string,
  sector: string,
  year: number,
): Map<string, Cell> | null {
  const file = valuesOf(data, level, sector);
  if (!file) return null;
  const series = findSeries(file, indicator, sector, year);
  return series ? cellsOf(file, series) : new Map();
}

/** Whether the map can go down to municipalities for what is on screen. */
export function hasMunicipalities(resolved: Resolved): boolean {
  return (
    !isBivariate(resolved.layer) &&
    resolved.indicator.levels.includes("municipality")
  );
}

/** Palette position of a cell of the bivariate map, or null when either axis has no value. */
export function bivariateCell(
  x: number | null,
  y: number | null,
  breaks: number[],
  breaks2: number[],
  higherIsBetter: boolean,
): { row: number; column: number } | null {
  const position = bivariateIndex(x, y, breaks, breaks2, higherIsBetter);
  if (!position) return null;
  return {
    row: spread(position.row, breaks2.length + 1, BIVARIATE_CLASSES),
    column: spread(position.column, breaks.length + 1, BIVARIATE_CLASSES),
  };
}

/** The colour of class `index`; with fewer classes than colours, the extremes are kept. */
export function sequentialColor(
  palette: Palette,
  index: number,
  breaks: number[],
): string {
  return (
    palette.sequential[spread(index, breaks.length + 1, CLASSES)] ??
    palette.noData
  );
}

/** Colours of every territory of `level`. The level's files must have loaded. */
export function paintFor(
  data: Data,
  resolved: Resolved,
  palette: Palette,
  level: Level,
): MapPaint {
  const { indicator, indicator2, sector, year } = resolved;
  const cells =
    cellsFor(data, level, indicator.id, sector, year) ??
    new Map<string, Cell>();
  const fills = new Map<string, string>();
  const missing = new Map<string, MissingReason>();

  if (indicator2) {
    const cells2 =
      cellsFor(data, level, indicator2.id, "total", year) ??
      new Map<string, Cell>();
    const breaks = quantileBreaks(
      valuesWithoutNational(cells),
      BIVARIATE_CLASSES,
    );
    const breaks2 = quantileBreaks(
      valuesWithoutNational(cells2),
      BIVARIATE_CLASSES,
    );
    for (const [id, cell] of cells) {
      if (id === NATIONAL) continue;
      const other = cells2.get(id);
      const position = bivariateCell(
        cell.value,
        other?.value ?? null,
        breaks,
        breaks2,
        indicator2.higher_is_better !== false,
      );
      const color =
        position && palette.bivariate[position.row]?.[position.column];
      if (color) fills.set(id, color);
      else missing.set(id, cell.reason ?? other?.reason ?? "not_published");
    }
    return { fills, missing, breaks, breaks2, cells, cells2 };
  }

  const breaks = quantileBreaks(valuesWithoutNational(cells), CLASSES);
  for (const [id, cell] of cells) {
    if (id === NATIONAL) continue;
    if (cell.value === null) missing.set(id, cell.reason);
    else
      fills.set(
        id,
        sequentialColor(palette, classIndex(cell.value, breaks), breaks),
      );
  }
  return { fills, missing, breaks, breaks2: [], cells, cells2: null };
}

export interface Reading {
  /** The territory the value belongs to: the one asked for, or its state. */
  territory: string;
  /** True when the indicator is not published for municipalities and the state stands in. */
  fromState: boolean;
  year: number;
  sector: string;
  /** Every territory of that level for the same series; null while it loads. */
  cells: Map<string, Cell> | null;
}

/**
 * Where to read an indicator for a territory, using the sector and year of the map
 * when the indicator has them. An indicator published only for states is read from
 * the municipality's state, and the reading says so.
 */
export function readingFor(
  data: Data,
  indicator: Indicator,
  sector: string,
  year: number,
  territory: string,
): Reading {
  const shownYear = indicator.years.includes(year)
    ? year
    : Math.max(...indicator.years);
  const shownSector = indicator.by_sector ? sector : "total";
  const fromState = !indicator.levels.includes(levelOf(territory));
  const own = fromState ? stateOf(territory) : territory;
  return {
    territory: own,
    fromState,
    year: shownYear,
    sector: shownSector,
    cells: cellsFor(data, levelOf(own), indicator.id, shownSector, shownYear),
  };
}

export function reasonLabel(data: Data, reason: MissingReason): string {
  return (
    data.catalog.missing_reasons.find((r) => r.id === reason)?.label ??
    "Sin dato"
  );
}

/** The text that stands for a cell: the formatted value, or the reason it is missing. */
export function cellText(data: Data, cell: Cell, indicator: Indicator): string {
  return cell.value === null
    ? reasonLabel(data, cell.reason)
    : formatValue(cell.value, indicator.unit, indicator.decimals);
}

/**
 * The distinct sources of one or more indicators, in the order they first appear.
 * A source that describes other years than the one on screen is left out.
 */
export function sourcesOf(
  data: Data,
  indicators: Indicator[],
  year: number,
): Source[] {
  const ids = [...new Set(indicators.flatMap((i) => i.sources))];
  return ids
    .map((id) => data.catalog.sources.find((s) => s.id === id))
    .filter((s): s is Source => s !== undefined)
    .filter((s) => !s.years || s.years.includes(year));
}

/** "INEGI, Censos Económicos 2024; …" as plain text for the legend. */
export function sourceLine(
  data: Data,
  indicators: Indicator[],
  year: number,
): string {
  return sourcesOf(data, indicators, year)
    .map((s) => `${s.institution}, ${s.name}`)
    .join("; ");
}
