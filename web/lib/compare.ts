/** What the compare view and the counterargument panel show. No React here. */

import { type Data, NATIONAL } from "./data";
import type { Indicator } from "./types";
import { cellsFor, indicatorById } from "./view";

export interface Section {
  title: string;
  indicators: Indicator[];
}

function indicators(data: Data, ids: string[]): Indicator[] {
  return [...new Set(ids)]
    .map((id) => indicatorById(data, id))
    .filter((i): i is Indicator => i !== undefined);
}

/** Every indicator once, grouped as the reader meets them: by layer, then the counterargument. */
export function compareSections(data: Data): Section[] {
  const seen = new Set<string>();
  const fresh = (ids: string[]) => {
    const list = indicators(data, ids).filter((i) => !seen.has(i.id));
    for (const i of list) seen.add(i.id);
    return list;
  };
  const { counterargument } = data.catalog;
  const sections = data.catalog.layers.map((layer) => ({
    title: layer.question,
    indicators: fresh([
      ...(layer.indicators ?? []),
      ...(layer.context ?? []),
      ...(layer.integration ?? []),
      ...(layer.conditions ?? []),
    ]),
  }));
  sections.push({
    title: counterargument.title,
    indicators: fresh([
      ...counterargument.pairs.flatMap((p) => [p.foreign, p.domestic]),
      ...counterargument.single,
    ]),
  });
  return sections.filter((s) => s.indicators.length > 0);
}

export interface PairCount {
  /** States where the figure with foreign capital is higher, lower or equal. */
  higher: number;
  lower: number;
  equal: number;
  /** States with a value in both groups; the others are left out of the count. */
  of: number;
}

/** How the two groups of a counterargument pair compare across the states. */
export function pairCount(
  data: Data,
  foreign: string,
  domestic: string,
  sector: string,
  year: number,
): PairCount {
  const withForeign = cellsFor(data, "state", foreign, sector, year);
  const without = cellsFor(data, "state", domestic, sector, year);
  const count: PairCount = { higher: 0, lower: 0, equal: 0, of: 0 };
  for (const [id, cell] of withForeign ?? []) {
    const other = without?.get(id);
    if (id === NATIONAL || cell.value === null || other?.value == null)
      continue;
    count.of += 1;
    if (cell.value > other.value) count.higher += 1;
    else if (cell.value < other.value) count.lower += 1;
    else count.equal += 1;
  }
  return count;
}
