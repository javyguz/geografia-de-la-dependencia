/** Data colours approved in docs/spec.md §5. The interface tokens live in globals.css. */

export type Theme = "light" | "dark";

export interface Palette {
  /** Five classes, lowest to highest. */
  sequential: string[];
  /** 3×3, indexed [row][column]; rows go from low to high conditions. */
  bivariate: string[][];
  noData: string;
  noDataHatch: string;
  /** Outline of the selected territory and its halo. */
  selection: string;
  selectionHalo: string;
  border: string;
  canvas: string;
}

const LIGHT: Palette = {
  sequential: ["#d3ddfd", "#a2b4f5", "#6d83e6", "#4657bd", "#283380"],
  bivariate: [
    ["#e9e9e7", "#a1b4f8", "#4556d9"],
    ["#fcb17e", "#ae8888", "#4b3f76"],
    ["#da720d", "#96570f", "#40260b"],
  ],
  noData: "#d5d6d8",
  noDataHatch: "#a9acb0",
  selection: "#1a1c1f",
  selectionHalo: "#ffffff",
  border: "#ffffff",
  canvas: "#eef0f2",
};

// In the dark theme the scales are reversed so that "more" is lighter. The bivariate
// palette is the light one with its lightness mirrored (OKLab) into 0.50-0.92; worst
// pair ΔE 9.0 under colour-blindness simulation, 10.4 with normal vision, and every
// cell has at least 3:1 contrast with the canvas. See docs/decisiones.md.
const DARK: Palette = {
  sequential: ["#283380", "#4657bd", "#6d83e6", "#a2b4f5", "#d3ddfd"],
  bivariate: [
    ["#636362", "#6b7cbc", "#8aa8ff"],
    ["#aa6532", "#b38d8d", "#cdc3ff"],
    ["#e1791c", "#e9a466", "#ffddbf"],
  ],
  noData: "#2b2d30",
  noDataHatch: "#4a4d51",
  selection: "#eceef0",
  selectionHalo: "#0e0f10",
  border: "#0e0f10",
  canvas: "#0e0f10",
};

export function paletteFor(theme: Theme): Palette {
  return theme === "dark" ? DARK : LIGHT;
}
