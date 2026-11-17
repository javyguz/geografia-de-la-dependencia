import { NATIONAL } from "./data";
import type { Cell } from "./types";

/** Position of a territory among those that have a value (1 = highest), and how many do. */
export function rankOf(
  cells: Map<string, Cell>,
  territory: string,
): { position: number; of: number } | null {
  const own = cells.get(territory);
  if (!own || own.value === null) return null;
  let above = 0;
  let of = 0;
  for (const [id, cell] of cells) {
    if (id === NATIONAL || cell.value === null) continue;
    of += 1;
    if (cell.value > own.value) above += 1;
  }
  return { position: above + 1, of };
}

/** Values of every territory except the national row, without the missing ones. */
export function valuesWithoutNational(cells: Map<string, Cell>): number[] {
  const values: number[] = [];
  for (const [id, cell] of cells) {
    if (id !== NATIONAL && cell.value !== null) values.push(cell.value);
  }
  return values;
}
