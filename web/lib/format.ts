import type { Indicator, Unit } from "./types";

const UNIT_LABELS: Record<Unit, string> = {
  percent: "%",
  mxn_thousands: "miles de pesos",
  mxn: "pesos",
  usd: "dólares",
  count: "",
};

function number(value: number, decimals: number): string {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Percentages are stored as proportions; every other unit is stored as shown. */
export function formatValue(
  value: number,
  unit: Unit,
  decimals: number,
): string {
  if (unit === "percent") return `${number(value * 100, decimals)} %`;
  const label = UNIT_LABELS[unit];
  return label
    ? `${number(value, decimals)} ${label}`
    : number(value, decimals);
}

export function formatIndicator(value: number, indicator: Indicator): string {
  return formatValue(value, indicator.unit, indicator.decimals);
}

/** A bare number for legends, where the unit is written once beside the scale. */
export function formatBare(
  value: number,
  unit: Unit,
  decimals: number,
): string {
  return unit === "percent"
    ? number(value * 100, decimals)
    : number(value, decimals);
}

export function unitLabel(unit: Unit): string {
  return UNIT_LABELS[unit];
}
