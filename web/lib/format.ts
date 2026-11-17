const percentFormatter = new Intl.NumberFormat("es-MX", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formats a proportion between 0 and 1 as a percentage with one decimal. */
export function formatPercent(proportion: number): string {
  return percentFormatter.format(proportion);
}
