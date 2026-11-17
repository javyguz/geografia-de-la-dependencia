/** Reads the first view's data from disk at build time. Server only. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Initial } from "./data";
import type { Catalog, Territory, ValuesFile } from "./types";

const DATA = join(process.cwd(), "public", "data");

function read<T>(path: string): T {
  return JSON.parse(readFileSync(join(DATA, path), "utf-8")) as T;
}

export function readInitial(): Initial {
  return {
    catalog: read<Catalog>("catalog.json"),
    territories: read<Territory[]>("territories.json").filter(
      (t) => t.level === "state",
    ),
    states: read<ValuesFile>("values/states.json"),
  };
}
