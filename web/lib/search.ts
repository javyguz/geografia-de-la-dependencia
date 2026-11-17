import type { Territory } from "./types";

/** At most this many results; enough to tell apart the municipalities that share a name. */
export const LIMIT = 30;

/** Lower case without accents, so "Mexico" finds "México". */
export function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Territories whose name contains the query, states first, then names that start
 * with it. With an empty query, the 32 states.
 */
export function searchTerritories(
  territories: Territory[],
  query: string,
): Territory[] {
  const wanted = plain(query.trim());
  if (!wanted) return territories.filter((t) => t.level === "state");
  const score = (t: Territory) =>
    (t.level === "state" ? 0 : 2) + (plain(t.name).startsWith(wanted) ? 0 : 1);
  return territories
    .filter((t) => plain(t.name).includes(wanted))
    .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, "es"))
    .slice(0, LIMIT);
}
