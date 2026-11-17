/** Classification of values into quantile classes. Pure functions, no map code. */

/** The value at fraction `p` of the sorted array, interpolating between neighbours. */
function quantile(sorted: number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;
  return low + (high - low) * (position - lower);
}

/**
 * The thresholds that split the values into up to `classes` equal-count classes.
 * Missing values are not passed in: they never shape the scale. When many values
 * tie (a sector where most entities are at 0 %), several quantiles coincide and
 * the repeated thresholds are dropped, so there are fewer classes rather than
 * empty ones. For the same reason a threshold at the maximum is dropped (many
 * municipalities at exactly 100 %): no value could fall above it.
 */
export function quantileBreaks(values: number[], classes: number): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const highest = sorted[sorted.length - 1] ?? 0;
  const breaks = Array.from({ length: classes - 1 }, (_, i) =>
    quantile(sorted, (i + 1) / classes),
  );
  return [...new Set(breaks)].filter((b) => b < highest);
}

/**
 * Index of the class a value falls in, from 0 (lowest) to `breaks.length`.
 * A class includes its upper threshold, so a value tied with the lowest threshold
 * stays in the lowest class instead of jumping to the top.
 */
export function classIndex(value: number, breaks: number[]): number {
  let index = 0;
  for (const threshold of breaks) {
    if (value > threshold) index += 1;
  }
  return index;
}

/** Position in a palette of `size` colours for class `index` out of `count` classes. */
export function spread(index: number, count: number, size: number): number {
  if (count <= 1) return Math.floor((size - 1) / 2);
  return Math.round((index * (size - 1)) / (count - 1));
}

/** The 3×3 cell of a bivariate map: column from the first axis, row from the second. */
export function bivariateIndex(
  column: number | null,
  row: number | null,
  columnBreaks: number[],
  rowBreaks: number[],
  rowHigherIsBetter: boolean,
): { column: number; row: number } | null {
  if (column === null || row === null) return null;
  const rowClass = classIndex(row, rowBreaks);
  return {
    column: classIndex(column, columnBreaks),
    // "High" on the conditions axis always means better conditions, so rates where
    // a higher value is worse (informality, working poverty) are flipped.
    row: rowHigherIsBetter ? rowClass : rowBreaks.length - rowClass,
  };
}
