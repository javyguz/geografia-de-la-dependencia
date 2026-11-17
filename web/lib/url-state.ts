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
  mode: Mode;
  /** Territories side by side in the compare view, in the order they were added. */
  compare: string[];
  /** The counterargument panel takes the place of the detail panel. */
  counterargument: boolean;
}

export type Mode = "explore" | "compare";

export const DEFAULT_LAYER = "foreign_capital";
export const MAX_COMPARED = 3;

const MODES: Record<Mode, string> = {
  explore: "explorar",
  compare: "comparar",
};
const COUNTERARGUMENT = "contraargumento";
const CVEGEO = /^(\d{2}|\d{5})$/;

const PARAMS = {
  layer: "capa",
  indicator: "ind",
  indicator2: "ind2",
  sector: "sector",
  year: "anio",
  territory: "t",
  mode: "modo",
  compare: "cmp",
  panel: "panel",
} as const;

export function emptyState(): ViewState {
  return {
    layer: DEFAULT_LAYER,
    indicator: null,
    indicator2: null,
    sector: "total",
    year: null,
    territory: null,
    mode: "explore",
    compare: [],
    counterargument: false,
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
    mode: params.get(PARAMS.mode) === MODES.compare ? "compare" : "explore",
    compare: [
      ...new Set(
        (params.get(PARAMS.compare) ?? "")
          .split(",")
          .filter((id) => CVEGEO.test(id)),
      ),
    ].slice(0, MAX_COMPARED),
    counterargument: params.get(PARAMS.panel) === COUNTERARGUMENT,
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
  if (state.mode !== "explore") params.set(PARAMS.mode, MODES[state.mode]);
  if (state.compare.length) params.set(PARAMS.compare, state.compare.join(","));
  if (state.counterargument) params.set(PARAMS.panel, COUNTERARGUMENT);
  const text = params.toString();
  // Commas are legal in a query; leaving them plain keeps shared links readable.
  return text ? `?${text.replaceAll("%2C", ",")}` : "";
}
