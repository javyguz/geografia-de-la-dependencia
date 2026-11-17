/** The guided tour: its steps come from content/tour.json, which the author edits. */

import tourFile from "../content/tour.json";
import { parseState, type ViewState } from "./url-state";

export interface TourStep {
  title: string;
  text: string;
  /** The URL query of the view, from "?"; empty for the starting view. */
  view: string;
  /** Provisional text, shown as such. */
  draft: boolean;
}

export const STEPS: TourStep[] = tourFile.steps;

/** What a step changes on the map. Anything the step does not set goes back to its default. */
export function stepView(step: TourStep, index: number): Partial<ViewState> {
  const { layer, indicator, indicator2, sector, year, territory } = parseState(
    step.view,
  );
  return {
    layer,
    indicator,
    indicator2,
    sector,
    year,
    territory,
    mode: "tour",
    step: index,
    counterargument: false,
  };
}

/** Splits the text into paragraphs at blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
