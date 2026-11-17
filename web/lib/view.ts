/**
 * Turns the explorer state into what the map paints: which series, which colour
 * each territory gets and what the legend says. No map or React code here.
 */

import { bivariateIndex, classIndex, quantileBreaks, spread } from "./classify";
import { cellsOf, findSeries, NATIONAL, type StateData } from "./data";
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

export function layerById(data: StateData, id: string): Layer {
  return (
    data.catalog.layers.find((l) => l.id === id) ??
    (data.catalog.layers[0] as Layer)
  );
}

export function indicatorById(
  data: StateData,
  id: string,
): Indicator | undefined {
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
export function resolve(data: StateData, state: ViewState): Resolved {
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

function cellsFor(
  data: StateData,
  indicator: string,
  sector: string,
  year: number,
): Map<string, Cell> | null {
  const series = findSeries(data.values, indicator, sector, year);
  return series ? cellsOf(data.values, series) : null;
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

export function paintFor(
  data: StateData,
  resolved: Resolved,
  palette: Palette,
): MapPaint {
  const { indicator, indicator2, sector, year } = resolved;
  const cells =
    cellsFor(data, indicator.id, sector, year) ?? new Map<string, Cell>();
  const fills = new Map<string, string>();
  const missing = new Map<string, MissingReason>();

  if (indicator2) {
    const cells2 =
      cellsFor(data, indicator2.id, "total", year) ?? new Map<string, Cell>();
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

/** What the indicator shows for a territory, using the sector and year of the map when it has them. */
export function valueFor(
  data: StateData,
  indicator: Indicator,
  sector: string,
  year: number,
  territory: string,
): { cell: Cell; year: number } | null {
  const shownYear = indicator.years.includes(year)
    ? year
    : Math.max(...indicator.years);
  const shownSector = indicator.by_sector ? sector : "total";
  const series = findSeries(data.values, indicator.id, shownSector, shownYear);
  const cell = series ? cellsOf(data.values, series).get(territory) : undefined;
  return cell ? { cell, year: shownYear } : null;
}

export function reasonLabel(data: StateData, reason: MissingReason): string {
  return (
    data.catalog.missing_reasons.find((r) => r.id === reason)?.label ??
    "Sin dato"
  );
}

/** The text that stands for a cell: the formatted value, or the reason it is missing. */
export function cellText(
  data: StateData,
  cell: Cell,
  indicator: Indicator,
): string {
  return cell.value === null
    ? reasonLabel(data, cell.reason)
    : formatValue(cell.value, indicator.unit, indicator.decimals);
}

/**
 * The distinct sources of one or more indicators, in the order they first appear.
 * A source that describes other years than the one on screen is left out.
 */
export function sourcesOf(
  data: StateData,
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
  data: StateData,
  indicators: Indicator[],
  year: number,
): string {
  return sourcesOf(data, indicators, year)
    .map((s) => `${s.institution}, ${s.name}`)
    .join("; ");
}
