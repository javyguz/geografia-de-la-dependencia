/**
 * The state of the explorer lives in the URL so any view can be shared.
 * Values equal to the defaults are not written.
 */

export interface ViewState {
  layer: string;
  indicator: string | null;
  /** Second axis of the bivariate layer. */
  indicator2: string | null;
  sector: string;
  year: number | null;
  territory: string | null;
}

export const DEFAULT_LAYER = "foreign_capital";

const PARAMS = {
  layer: "capa",
  indicator: "ind",
  indicator2: "ind2",
  sector: "sector",
  year: "anio",
  territory: "t",
} as const;

export function emptyState(): ViewState {
  return {
    layer: DEFAULT_LAYER,
    indicator: null,
    indicator2: null,
    sector: "total",
    year: null,
    territory: null,
  };
}

export function parseState(search: string): ViewState {
  const params = new URLSearchParams(search);
  const year = Number(params.get(PARAMS.year));
  return {
    layer: params.get(PARAMS.layer) ?? DEFAULT_LAYER,
    indicator: params.get(PARAMS.indicator),
    indicator2: params.get(PARAMS.indicator2),
    sector: params.get(PARAMS.sector) ?? "total",
    year: Number.isInteger(year) && year > 0 ? year : null,
    territory: params.get(PARAMS.territory),
  };
}

export function serializeState(state: ViewState): string {
  const params = new URLSearchParams();
  if (state.layer !== DEFAULT_LAYER) params.set(PARAMS.layer, state.layer);
  if (state.indicator) params.set(PARAMS.indicator, state.indicator);
  if (state.indicator2) params.set(PARAMS.indicator2, state.indicator2);
  if (state.sector !== "total") params.set(PARAMS.sector, state.sector);
  if (state.year !== null) params.set(PARAMS.year, String(state.year));
  if (state.territory) params.set(PARAMS.territory, state.territory);
  const text = params.toString();
  return text ? `?${text}` : "";
}
