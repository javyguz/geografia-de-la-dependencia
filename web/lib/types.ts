/** Shapes of the JSON files the pipeline writes to `public/data/`. */

export type Unit = "percent" | "mxn_thousands" | "mxn" | "usd" | "count";

export type MissingReason =
  | "confidential"
  | "not_published"
  | "not_collected"
  | "not_computable"
  | "no_population";

export interface Source {
  id: string;
  name: string;
  institution: string;
  url: string;
  license: string;
  license_url: string;
  retrieved_at: string;
  /** Years the source describes, when it covers only some of an indicator's years. */
  years?: number[];
}

export interface Sector {
  id: string;
  name: string;
}

export interface MissingReasonInfo {
  id: MissingReason;
  label: string;
  description: string;
}

export interface Indicator {
  id: string;
  name: string;
  definition: string;
  formula: string;
  unit: Unit;
  decimals: number;
  higher_is_better?: boolean;
  /** Which year each input comes from, when the indicator mixes years. */
  year_note?: string;
  sources: string[];
  levels: ("state" | "municipality")[];
  years: number[];
  by_sector: boolean;
  coverage: string;
  limitations: string[];
  warning?: string;
}

export interface Layer {
  id: string;
  question: string;
  description: string;
  /** Indicators shown one at a time on the map. Absent in the bivariate layer. */
  indicators?: string[];
  /** Indicators that always accompany the map ones in the detail panel. */
  context?: string[];
  /** Bivariate layer: the two axes. */
  integration?: string[];
  conditions?: string[];
}

export interface Catalog {
  generated_at: string;
  sources: Source[];
  sectors: Sector[];
  missing_reasons: MissingReasonInfo[];
  layers: Layer[];
  counterargument: { pairs: [string, string][]; single: string[] };
  indicators: Indicator[];
}

export interface Territory {
  id: string;
  name: string;
  level: "state" | "municipality";
  state: string;
  population: number | null;
}

export interface Series {
  indicator: string;
  sector: string;
  year: number;
  values: (number | null)[];
  /** Reason → positions in `values` that are null for that reason. */
  missing: Partial<Record<MissingReason, number[]>>;
}

export interface ValuesFile {
  level: "state" | "municipality";
  territories: string[];
  series: Series[];
}

/** The value of one indicator for one territory, or why it is absent. */
export type Cell =
  | { value: number; reason: null }
  | { value: null; reason: MissingReason };
