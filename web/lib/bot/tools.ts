/**
 * The assistant's tools: pure functions over the data already loaded in the page.
 * Every figure the assistant gives comes out of one of these, with its unit,
 * year, territory and source attached (docs/spec.md §4).
 */

import { type Data, type Level, levelOf, NATIONAL, stateOf } from "../data";
import { formatValue } from "../format";
import { searchTerritories } from "../search";
import type { Indicator, MissingReason } from "../types";
import type { ViewState } from "../url-state";
import { cellsFor, indicatorById, sourcesOf } from "../view";

export interface ToolValue {
  indicator: string;
  indicator_name: string;
  territory: string;
  territory_name: string;
  sector: string;
  sector_name: string;
  year: number;
  value: number | null;
  formatted: string;
  missing_reason: MissingReason | null;
  source: string;
  source_url: string;
  /** Present when the value is not the one asked for, and why. */
  note?: string;
}

export interface ToolError {
  error: string;
}

const isError = (x: unknown): x is ToolError =>
  typeof x === "object" && x !== null && "error" in x;

interface Series {
  indicator: Indicator;
  sector: string;
  year: number;
}

function nameOf(data: Data, id: string): string {
  if (id === NATIONAL) return "Nacional";
  const territory = data.territories.get(id);
  if (!territory) return id;
  return territory.level === "municipality"
    ? `${territory.name}, ${data.territories.get(territory.state)?.name ?? ""}`
    : territory.name;
}

function sectorName(data: Data, id: string): string {
  return data.catalog.sectors.find((s) => s.id === id)?.name ?? id;
}

/** Checks indicator, sector and year, and fills in the defaults: all sectors and the latest year. */
function seriesOf(
  data: Data,
  args: { indicator?: unknown; sector?: unknown; year?: unknown },
): Series | ToolError {
  const indicator = indicatorById(data, String(args.indicator ?? ""));
  if (!indicator)
    return {
      error: `No existe el indicador «${String(args.indicator)}». Usa uno de: ${data.catalog.indicators.map((i) => i.id).join(", ")}.`,
    };
  const sector = args.sector == null ? "total" : String(args.sector);
  if (sector !== "total" && !indicator.by_sector)
    return {
      error: `«${indicator.name}» no tiene desglose por sector; pregunta por el total.`,
    };
  if (!data.catalog.sectors.some((s) => s.id === sector))
    return { error: `No existe el sector «${sector}».` };
  const year =
    args.year == null ? Math.max(...indicator.years) : Number(args.year);
  if (!indicator.years.includes(year))
    return {
      error: `«${indicator.name}» solo tiene datos de ${indicator.years.join(" y ")}.`,
    };
  return { indicator, sector, year };
}

function territoryOf(data: Data, id: unknown): string | ToolError {
  const key = String(id ?? "");
  if (key === NATIONAL || data.territories.has(key)) return key;
  return {
    error: `No existe el territorio «${key}». Busca su clave con find_territory.`,
  };
}

/** The value of one series for one territory, in the form every tool returns. */
function toolValue(
  data: Data,
  { indicator, sector, year }: Series,
  territory: string,
): ToolValue | ToolError {
  // An indicator published only by state is answered with the state, and says so.
  const own =
    levelOf(territory) === "municipality" &&
    !indicator.levels.includes("municipality")
      ? stateOf(territory)
      : territory;
  const cells = cellsFor(data, levelOf(own), indicator.id, sector, year);
  if (!cells)
    return { error: "Los datos municipales no se han cargado todavía." };
  const cell = cells.get(own);
  const sources = sourcesOf(data, [indicator], year);
  const missing =
    cell?.value == null ? (cell?.reason ?? "not_published") : null;
  return {
    indicator: indicator.id,
    indicator_name: indicator.name,
    territory: own,
    territory_name: nameOf(data, own),
    sector,
    sector_name: sectorName(data, sector),
    year,
    value: cell?.value ?? null,
    formatted:
      cell?.value != null
        ? formatValue(cell.value, indicator.unit, indicator.decimals)
        : (data.catalog.missing_reasons.find((r) => r.id === missing)?.label ??
          "Sin dato"),
    missing_reason: missing,
    source: sources.map((s) => `${s.institution}, ${s.name}`).join("; "),
    source_url: sources[0]?.url ?? "",
    ...(own !== territory && {
      note: `«${indicator.name}» no se publica por municipio; este es el valor de ${nameOf(data, own)}.`,
    }),
  };
}

export function findTerritory(data: Data, args: { query?: unknown }) {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "Escribe el nombre de un lugar." };
  const matches = searchTerritories([...data.territories.values()], query)
    .filter((t) => t.id !== NATIONAL)
    .slice(0, 5)
    .map((t) => ({
      territory: t.id,
      name: t.name,
      level: t.level,
      state: t.level === "municipality" ? nameOf(data, t.state) : t.name,
    }));
  return matches.length
    ? { matches }
    : { matches, error: `Ningún lugar se llama «${query}».` };
}

export function describeIndicator(data: Data, args: { indicator?: unknown }) {
  const indicator = indicatorById(data, String(args.indicator ?? ""));
  if (!indicator)
    return { error: `No existe el indicador «${String(args.indicator)}».` };
  const layer = data.catalog.layers.find((l) =>
    [l.indicators, l.context, l.integration, l.conditions].some((ids) =>
      ids?.includes(indicator.id),
    ),
  );
  return {
    indicator: indicator.id,
    name: indicator.name,
    layer: layer?.question ?? data.catalog.counterargument.title,
    definition: indicator.definition,
    formula: indicator.formula,
    unit: indicator.unit,
    years: indicator.year_note ?? indicator.years.join(" y "),
    levels: indicator.levels,
    by_sector: indicator.by_sector,
    coverage: indicator.coverage,
    limitations: indicator.limitations,
    ...(indicator.warning && { warning: indicator.warning }),
    sources: sourcesOf(data, [indicator], Math.max(...indicator.years)).map(
      (s) => ({ name: `${s.institution}, ${s.name}`, url: s.url }),
    ),
  };
}

export function getValue(
  data: Data,
  args: {
    indicator?: unknown;
    territory?: unknown;
    sector?: unknown;
    year?: unknown;
  },
) {
  const series = seriesOf(data, args);
  if (isError(series)) return series;
  const territory = territoryOf(data, args.territory);
  if (isError(territory)) return territory;
  return toolValue(data, series, territory);
}

export function compare(
  data: Data,
  args: {
    indicator?: unknown;
    territories?: unknown;
    sector?: unknown;
    year?: unknown;
  },
) {
  const series = seriesOf(data, args);
  if (isError(series)) return series;
  const ids = Array.isArray(args.territories) ? args.territories : [];
  if (ids.length < 2 || ids.length > 5)
    return { error: "Compara entre 2 y 5 territorios." };
  const values = [];
  for (const id of ids) {
    const territory = territoryOf(data, id);
    if (isError(territory)) return territory;
    values.push(toolValue(data, series, territory));
  }
  return { values, national: toolValue(data, series, NATIONAL) };
}

export function rank(
  data: Data,
  args: {
    indicator?: unknown;
    level?: unknown;
    order?: unknown;
    limit?: unknown;
    within_state?: unknown;
    sector?: unknown;
    year?: unknown;
  },
) {
  const series = seriesOf(data, args);
  if (isError(series)) return series;
  const level: Level = args.level === "municipality" ? "municipality" : "state";
  if (!series.indicator.levels.includes(level))
    return {
      error: `«${series.indicator.name}» no se publica por municipio; ordena entidades.`,
    };
  const within = args.within_state == null ? null : String(args.within_state);
  if (within !== null && (levelOf(within) !== "state" || within === NATIONAL))
    return {
      error: "within_state debe ser la clave de 2 dígitos de una entidad.",
    };
  const cells = cellsFor(
    data,
    level,
    series.indicator.id,
    series.sector,
    series.year,
  );
  if (!cells)
    return { error: "Los datos municipales no se han cargado todavía." };
  const scope = [...cells].filter(
    ([id]) => id !== NATIONAL && (within === null || stateOf(id) === within),
  );
  const withValue = scope
    .filter(
      (entry): entry is [string, { value: number; reason: null }] =>
        entry[1].value !== null,
    )
    .sort((a, b) =>
      args.order === "asc" ? a[1].value - b[1].value : b[1].value - a[1].value,
    );
  const missing: Partial<Record<MissingReason, number>> = {};
  for (const [, cell] of scope)
    if (cell.reason) missing[cell.reason] = (missing[cell.reason] ?? 0) + 1;
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
  return {
    indicator: series.indicator.id,
    indicator_name: series.indicator.name,
    level,
    order: args.order === "asc" ? "asc" : "desc",
    sector: series.sector,
    sector_name: sectorName(data, series.sector),
    year: series.year,
    ...(within && { within_state: nameOf(data, within) }),
    items: withValue.slice(0, limit).map(([id], i) => ({
      position: i + 1,
      ...toolValue(data, series, id),
    })),
    territories_with_value: withValue.length,
    territories_without_value: missing,
  };
}

/** The view that shows an indicator: its layer, or the counterargument panel. */
export function showOnMap(
  data: Data,
  args: {
    indicator?: unknown;
    territory?: unknown;
    sector?: unknown;
    year?: unknown;
  },
): { result: unknown; view: Partial<ViewState> | null } {
  const series = seriesOf(data, args);
  if (isError(series)) return { result: series, view: null };
  const territory =
    args.territory == null ? null : territoryOf(data, args.territory);
  if (isError(territory)) return { result: territory, view: null };
  const id = series.indicator.id;
  const layer = data.catalog.layers.find((l) =>
    [l.indicators, l.integration, l.conditions].some((ids) =>
      ids?.includes(id),
    ),
  );
  const place = territory === NATIONAL ? null : territory;
  const common = {
    mode: "explore" as const,
    territory: place,
    sector: series.sector,
  };
  const value = toolValue(data, series, territory ?? NATIONAL);
  if (!layer) {
    const { pairs, single } = data.catalog.counterargument;
    const counter =
      single.includes(id) ||
      pairs.some((p) => p.foreign === id || p.domestic === id);
    if (!counter)
      return {
        result: {
          error: `«${series.indicator.name}» no se pinta en el mapa; aparece en la ficha.`,
        },
        view: null,
      };
    return {
      result: { shown: `Panel «${data.catalog.counterargument.title}»`, value },
      view: { ...common, counterargument: true },
    };
  }
  const conditions = layer.conditions?.includes(id);
  return {
    result: {
      shown: `Mapa de «${series.indicator.name}», ${sectorName(data, series.sector)}, ${series.year}`,
      ...(place && { territory: nameOf(data, place) }),
      value,
    },
    view: {
      ...common,
      layer: layer.id,
      indicator: conditions ? null : id,
      indicator2: conditions ? id : null,
      year: series.year,
      counterargument: false,
    },
  };
}
